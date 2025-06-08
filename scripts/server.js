const express = require("express")
const multer = require("multer")
const cors = require("cors")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const mongoose = require("mongoose")
const path = require("path")
const fs = require("fs")
const PDFDocument = require("pdfkit")
const { createCanvas, loadImage } = require("canvas")

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static("public"))

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/pdfpro", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  plan: { type: String, enum: ["free", "premium"], default: "free" },
  subscriptionEnd: Date,
  createdAt: { type: Date, default: Date.now },
  lastLogin: Date,
  usageCount: { type: Number, default: 0 },
  dailyUsage: { type: Number, default: 0 },
  lastUsageReset: { type: Date, default: Date.now },
})

const User = mongoose.model("User", userSchema)

// File Operation Schema
const fileOperationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  fileName: String,
  originalName: String,
  operation: String,
  status: { type: String, enum: ["processing", "completed", "failed"], default: "processing" },
  inputPath: String,
  outputPath: String,
  fileSize: Number,
  createdAt: { type: Date, default: Date.now },
  completedAt: Date,
  errorMessage: String,
})

const FileOperation = mongoose.model("FileOperation", fileOperationSchema)

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/"
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname))
  },
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "image/jpeg",
      "image/png",
      "image/gif",
      "text/plain",
      "text/html",
    ]

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error("Unsupported file type"), false)
    }
  },
})

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Access token required" })
  }

  jwt.verify(token, process.env.JWT_SECRET || "your-secret-key", (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" })
    }
    req.user = user
    next()
  })
}

// Check usage limits
const checkUsageLimits = async (req, res, next) => {
  if (!req.user) {
    return next() // Guest user
  }

  try {
    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    // Reset daily usage if it's a new day
    const today = new Date()
    const lastReset = new Date(user.lastUsageReset)
    if (today.toDateString() !== lastReset.toDateString()) {
      user.dailyUsage = 0
      user.lastUsageReset = today
      await user.save()
    }

    // Check limits for free users
    if (user.plan === "free" && user.dailyUsage >= 3) {
      return res.status(429).json({
        error: "Daily usage limit exceeded. Upgrade to premium for unlimited access.",
      })
    }

    req.user.plan = user.plan
    next()
  } catch (error) {
    res.status(500).json({ error: "Server error" })
  }
}

// Auth Routes
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
    })

    await user.save()

    // Generate JWT
    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || "your-secret-key", {
      expiresIn: "7d",
    })

    res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: user.plan,
      },
    })
  } catch (error) {
    console.error("Signup error:", error)
    res.status(500).json({ error: "Server error" })
  }
})

app.post("/api/auth/signin", async (req, res) => {
  try {
    const { email, password } = req.body

    // Find user
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" })
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return res.status(400).json({ error: "Invalid credentials" })
    }

    // Update last login
    user.lastLogin = new Date()
    await user.save()

    // Generate JWT
    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || "your-secret-key", {
      expiresIn: "7d",
    })

    res.json({
      message: "Signed in successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        subscriptionEnd: user.subscriptionEnd,
      },
    })
  } catch (error) {
    console.error("Signin error:", error)
    res.status(500).json({ error: "Server error" })
  }
})

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    // In a real app, you would send an email with a reset link
    // For demo purposes, we'll just return a success message
    res.json({ message: "Password reset link sent to your email" })
  } catch (error) {
    console.error("Forgot password error:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// File Upload Route
app.post("/api/files/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" })
    }

    const fileOperation = new FileOperation({
      userId: req.user?.id,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      operation: "upload",
      status: "completed",
      inputPath: req.file.path,
      fileSize: req.file.size,
    })

    await fileOperation.save()

    res.json({
      message: "File uploaded successfully",
      fileId: fileOperation._id,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
    })
  } catch (error) {
    console.error("Upload error:", error)
    res.status(500).json({ error: "Upload failed" })
  }
})

// PDF Processing Routes
app.post("/api/pdf/edit", authenticateToken, checkUsageLimits, upload.single("file"), async (req, res) => {
  try {
    const { operation } = req.body

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" })
    }

    // Create file operation record
    const fileOperation = new FileOperation({
      userId: req.user?.id,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      operation: operation,
      status: "processing",
      inputPath: req.file.path,
      fileSize: req.file.size,
    })

    await fileOperation.save()

    // Update user usage
    if (req.user) {
      await User.findByIdAndUpdate(req.user.id, {
        $inc: { usageCount: 1, dailyUsage: 1 },
      })
    }

    // Simulate processing time
    setTimeout(async () => {
      try {
        // In a real app, you would process the PDF here
        const outputPath = `outputs/${Date.now()}-${operation}-${req.file.originalname}`

        // Create output directory if it doesn't exist
        const outputDir = path.dirname(outputPath)
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true })
        }

        // For demo, just copy the file
        fs.copyFileSync(req.file.path, outputPath)

        // Update operation status
        await FileOperation.findByIdAndUpdate(fileOperation._id, {
          status: "completed",
          outputPath: outputPath,
          completedAt: new Date(),
        })

        console.log(`PDF ${operation} completed for file: ${req.file.originalname}`)
      } catch (error) {
        console.error("Processing error:", error)
        await FileOperation.findByIdAndUpdate(fileOperation._id, {
          status: "failed",
          errorMessage: error.message,
        })
      }
    }, 2000)

    res.json({
      message: "PDF processing started",
      operationId: fileOperation._id,
      status: "processing",
    })
  } catch (error) {
    console.error("PDF edit error:", error)
    res.status(500).json({ error: "Processing failed" })
  }
})

// File Conversion Routes
app.post("/api/convert/pdf-to-other", authenticateToken, checkUsageLimits, upload.single("file"), async (req, res) => {
  try {
    const { targetFormat } = req.body

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" })
    }

    const fileOperation = new FileOperation({
      userId: req.user?.id,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      operation: `pdf-to-${targetFormat}`,
      status: "processing",
      inputPath: req.file.path,
      fileSize: req.file.size,
    })

    await fileOperation.save()

    // Update user usage
    if (req.user) {
      await User.findByIdAndUpdate(req.user.id, {
        $inc: { usageCount: 1, dailyUsage: 1 },
      })
    }

    // Simulate conversion
    setTimeout(async () => {
      try {
        const outputPath = `outputs/${Date.now()}-converted.${targetFormat}`
        const outputDir = path.dirname(outputPath)

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true })
        }

        // For demo, create a simple converted file
        if (targetFormat === "txt") {
          fs.writeFileSync(outputPath, "Converted text content from PDF")
        } else {
          fs.copyFileSync(req.file.path, outputPath)
        }

        await FileOperation.findByIdAndUpdate(fileOperation._id, {
          status: "completed",
          outputPath: outputPath,
          completedAt: new Date(),
        })

        console.log(`Conversion to ${targetFormat} completed`)
      } catch (error) {
        console.error("Conversion error:", error)
        await FileOperation.findByIdAndUpdate(fileOperation._id, {
          status: "failed",
          errorMessage: error.message,
        })
      }
    }, 3000)

    res.json({
      message: "Conversion started",
      operationId: fileOperation._id,
      status: "processing",
    })
  } catch (error) {
    console.error("Conversion error:", error)
    res.status(500).json({ error: "Conversion failed" })
  }
})

app.post("/api/convert/other-to-pdf", authenticateToken, checkUsageLimits, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" })
    }

    const fileOperation = new FileOperation({
      userId: req.user?.id,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      operation: "to-pdf",
      status: "processing",
      inputPath: req.file.path,
      fileSize: req.file.size,
    })

    await fileOperation.save()

    // Update user usage
    if (req.user) {
      await User.findByIdAndUpdate(req.user.id, {
        $inc: { usageCount: 1, dailyUsage: 1 },
      })
    }

    // Simulate conversion to PDF
    setTimeout(async () => {
      try {
        const outputPath = `outputs/${Date.now()}-converted.pdf`
        const outputDir = path.dirname(outputPath)

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true })
        }

        // Create a simple PDF
        const doc = new PDFDocument()
        doc.pipe(fs.createWriteStream(outputPath))
        doc.fontSize(20).text("Converted to PDF", 100, 100)
        doc.text(`Original file: ${req.file.originalname}`, 100, 150)
        doc.end()

        await FileOperation.findByIdAndUpdate(fileOperation._id, {
          status: "completed",
          outputPath: outputPath,
          completedAt: new Date(),
        })

        console.log("Conversion to PDF completed")
      } catch (error) {
        console.error("PDF conversion error:", error)
        await FileOperation.findByIdAndUpdate(fileOperation._id, {
          status: "failed",
          errorMessage: error.message,
        })
      }
    }, 3000)

    res.json({
      message: "PDF conversion started",
      operationId: fileOperation._id,
      status: "processing",
    })
  } catch (error) {
    console.error("PDF conversion error:", error)
    res.status(500).json({ error: "Conversion failed" })
  }
})

// Universal File Converter
app.post("/api/convert/universal", authenticateToken, checkUsageLimits, upload.single("file"), async (req, res) => {
  try {
    const { sourceFormat, targetFormat } = req.body

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" })
    }

    const fileOperation = new FileOperation({
      userId: req.user?.id,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      operation: `${sourceFormat}-to-${targetFormat}`,
      status: "processing",
      inputPath: req.file.path,
      fileSize: req.file.size,
    })

    await fileOperation.save()

    // Update user usage
    if (req.user) {
      await User.findByIdAndUpdate(req.user.id, {
        $inc: { usageCount: 1, dailyUsage: 1 },
      })
    }

    // Simulate universal conversion
    setTimeout(async () => {
      try {
        const outputPath = `outputs/${Date.now()}-converted.${targetFormat}`
        const outputDir = path.dirname(outputPath)

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true })
        }

        // For demo, just copy or create a simple converted file
        fs.copyFileSync(req.file.path, outputPath)

        await FileOperation.findByIdAndUpdate(fileOperation._id, {
          status: "completed",
          outputPath: outputPath,
          completedAt: new Date(),
        })

        console.log(`Universal conversion ${sourceFormat} to ${targetFormat} completed`)
      } catch (error) {
        console.error("Universal conversion error:", error)
        await FileOperation.findByIdAndUpdate(fileOperation._id, {
          status: "failed",
          errorMessage: error.message,
        })
      }
    }, 2500)

    res.json({
      message: "Universal conversion started",
      operationId: fileOperation._id,
      status: "processing",
    })
  } catch (error) {
    console.error("Universal conversion error:", error)
    res.status(500).json({ error: "Conversion failed" })
  }
})

// File Download Route
app.get("/api/download/:operationId", async (req, res) => {
  try {
    const operation = await FileOperation.findById(req.params.operationId)

    if (!operation) {
      return res.status(404).json({ error: "File not found" })
    }

    if (operation.status !== "completed") {
      return res.status(400).json({ error: "File not ready for download" })
    }

    if (!fs.existsSync(operation.outputPath)) {
      return res.status(404).json({ error: "File not found on server" })
    }

    const fileName = `processed-${operation.originalName}`
    res.download(operation.outputPath, fileName)
  } catch (error) {
    console.error("Download error:", error)
    res.status(500).json({ error: "Download failed" })
  }
})

// Get Operation Status
app.get("/api/operation/:operationId", async (req, res) => {
  try {
    const operation = await FileOperation.findById(req.params.operationId)

    if (!operation) {
      return res.status(404).json({ error: "Operation not found" })
    }

    res.json({
      id: operation._id,
      fileName: operation.originalName,
      operation: operation.operation,
      status: operation.status,
      createdAt: operation.createdAt,
      completedAt: operation.completedAt,
      downloadUrl: operation.status === "completed" ? `/api/download/${operation._id}` : null,
    })
  } catch (error) {
    console.error("Status check error:", error)
    res.status(500).json({ error: "Status check failed" })
  }
})

// Get User's File History
app.get("/api/files/history", authenticateToken, async (req, res) => {
  try {
    const operations = await FileOperation.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50)

    const history = operations.map((op) => ({
      id: op._id,
      fileName: op.originalName,
      operation: op.operation,
      status: op.status,
      createdAt: op.createdAt,
      completedAt: op.completedAt,
      downloadUrl: op.status === "completed" ? `/api/download/${op._id}` : null,
    }))

    res.json(history)
  } catch (error) {
    console.error("History error:", error)
    res.status(500).json({ error: "Failed to fetch history" })
  }
})

// Subscription Management (Stripe Integration)
app.post("/api/subscription/create", authenticateToken, async (req, res) => {
  try {
    const { plan, paymentMethodId } = req.body

    // In a real app, you would integrate with Stripe here
    // For demo purposes, we'll just update the user's plan

    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    // Simulate successful payment
    user.plan = plan
    user.subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    await user.save()

    res.json({
      message: "Subscription created successfully",
      plan: user.plan,
      subscriptionEnd: user.subscriptionEnd,
    })
  } catch (error) {
    console.error("Subscription error:", error)
    res.status(500).json({ error: "Subscription creation failed" })
  }
})

app.post("/api/subscription/cancel", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    // In a real app, you would cancel the Stripe subscription here
    user.plan = "free"
    user.subscriptionEnd = null
    await user.save()

    res.json({
      message: "Subscription cancelled successfully",
      plan: user.plan,
    })
  } catch (error) {
    console.error("Cancellation error:", error)
    res.status(500).json({ error: "Cancellation failed" })
  }
})

// Get User Profile
app.get("/api/user/profile", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password")
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    const operationsCount = await FileOperation.countDocuments({ userId: user._id })

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      subscriptionEnd: user.subscriptionEnd,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      usageCount: user.usageCount,
      dailyUsage: user.dailyUsage,
      totalOperations: operationsCount,
    })
  } catch (error) {
    console.error("Profile error:", error)
    res.status(500).json({ error: "Failed to fetch profile" })
  }
})

// Cleanup old files (run periodically)
const cleanupOldFiles = async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const oldOperations = await FileOperation.find({
      createdAt: { $lt: oneDayAgo },
    })

    for (const operation of oldOperations) {
      // Delete files
      if (operation.inputPath && fs.existsSync(operation.inputPath)) {
        fs.unlinkSync(operation.inputPath)
      }
      if (operation.outputPath && fs.existsSync(operation.outputPath)) {
        fs.unlinkSync(operation.outputPath)
      }

      // Delete operation record
      await FileOperation.findByIdAndDelete(operation._id)
    }

    console.log(`Cleaned up ${oldOperations.length} old operations`)
  } catch (error) {
    console.error("Cleanup error:", error)
  }
}

// Run cleanup every hour
setInterval(cleanupOldFiles, 60 * 60 * 1000)

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Server error:", error)

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large" })
    }
  }

  res.status(500).json({ error: "Internal server error" })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Endpoint not found" })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/api/health`)
})

module.exports = app
