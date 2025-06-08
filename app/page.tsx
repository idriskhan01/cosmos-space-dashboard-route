"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import {
  FileText,
  Upload,
  Download,
  Merge,
  Split,
  FileArchiveIcon as Compress,
  RotateCw,
  Lock,
  Unlock,
  Edit3,
  ImageIcon,
  FileSpreadsheet,
  Presentation,
  Type,
  Globe,
  BookOpen,
  Zap,
  Shield,
  Users,
  Star,
  Check,
  X,
  Sun,
  Moon,
  UserIcon,
  Settings,
  LogOut,
  CreditCard,
  History,
  HelpCircle,
  Trash2,
  ArrowLeft,
  Save,
  ZoomIn,
  ZoomOut,
  MousePointer,
  Square,
  Circle,
  PenTool,
  Highlighter,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// Types
interface AppUser {
  id: string
  email: string
  name: string
  plan: "free" | "premium"
  subscriptionEnd?: Date
}

interface FileOperation {
  id: string
  fileName: string
  operation: string
  status: "processing" | "completed" | "failed"
  progress: number
  downloadUrl?: string
  createdAt: Date
  fileSize?: number
  outputFileName?: string
}

interface SelectedFile {
  file: File
  preview?: string
  id: string
  url?: string
}

interface Annotation {
  id: string
  type: "text" | "highlight" | "rectangle" | "circle" | "arrow" | "freehand"
  x: number
  y: number
  width?: number
  height?: number
  text?: string
  color: string
  fontSize?: number
  page: number
}

interface PDFPage {
  id: string
  pageNumber: number
  width: number
  height: number
  rotation: number
  annotations: Annotation[]
}

// Main App Component
export default function PDFEditorPlatform() {
  const [currentView, setCurrentView] = useState("home")
  const [previousView, setPreviousView] = useState("home")
  const [user, setUser] = useState<AppUser | null>(null)
  const [darkMode, setDarkMode] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [fileOperations, setFileOperations] = useState<FileOperation[]>([])
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  const [currentEditingFile, setCurrentEditingFile] = useState<SelectedFile | null>(null)
  const [pdfPages, setPdfPages] = useState<PDFPage[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [selectedTool, setSelectedTool] = useState<string>("select")
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedColor, setSelectedColor] = useState("#ff0000")
  const [fontSize, setFontSize] = useState(16)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pdfContainerRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    // Check for saved user session
    if (typeof window !== "undefined") {
      const savedUser = localStorage.getItem("user")
      if (savedUser) {
        setUser(JSON.parse(savedUser))
      }

      // Check for dark mode preference
      const savedTheme = localStorage.getItem("theme")
      if (savedTheme === "dark") {
        setDarkMode(true)
        document.documentElement.classList.add("dark")
      }
    }
  }, [])

  const navigateTo = (view: string) => {
    setPreviousView(currentView)
    setCurrentView(view)
  }

  const goBack = () => {
    setCurrentView(previousView)
  }

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    if (typeof window !== "undefined") {
      if (!darkMode) {
        document.documentElement.classList.add("dark")
        localStorage.setItem("theme", "dark")
      } else {
        document.documentElement.classList.remove("dark")
        localStorage.setItem("theme", "light")
      }
    }
  }

  const handleSignOut = () => {
    setUser(null)
    if (typeof window !== "undefined") {
      localStorage.removeItem("user")
    }
    navigateTo("home")
    toast({
      title: "Signed out successfully",
      description: "You have been signed out of your account.",
    })
  }

  // File handling functions
  const validateFile = (file: File): boolean => {
    const maxSize = user?.plan === "premium" ? 100 * 1024 * 1024 : 10 * 1024 * 1024
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/bmp",
      "text/plain",
      "text/html",
      "text/markdown",
    ]

    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `File size must be less than ${user?.plan === "premium" ? "100MB" : "10MB"}.`,
        variant: "destructive",
      })
      return false
    }

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Unsupported file type",
        description: "Please select a supported file format.",
        variant: "destructive",
      })
      return false
    }

    return true
  }

  const createFilePreview = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.readAsDataURL(file)
      } else if (file.type === "application/pdf") {
        // For PDFs, we'll create a thumbnail later
        resolve("/placeholder.svg?height=100&width=100")
      } else {
        resolve("")
      }
    })
  }

  const addFiles = async (files: FileList) => {
    const newFiles: SelectedFile[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (validateFile(file)) {
        const preview = await createFilePreview(file)
        const url = URL.createObjectURL(file)
        newFiles.push({
          file,
          preview,
          id: Date.now().toString() + i,
          url,
        })
      }
    }

    if (newFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...newFiles])
      toast({
        title: "Files added",
        description: `${newFiles.length} file(s) ready for processing.`,
      })
    }
  }

  const removeFile = (fileId: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  const clearAllFiles = () => {
    setSelectedFiles([])
  }

  // PDF Editor Functions
  const openPDFEditor = (file: SelectedFile) => {
    setCurrentEditingFile(file)
    setPdfLoaded(false)

    // Initialize PDF pages (simulated)
    const pageCount = 5 // We'll simulate 5 pages
    const pages: PDFPage[] = Array.from({ length: pageCount }, (_, i) => ({
      id: `page-${i + 1}`,
      pageNumber: i + 1,
      width: 595,
      height: 842,
      rotation: 0,
      annotations: [],
    }))

    setPdfPages(pages)
    setCurrentPage(1)
    setAnnotations([])
    navigateTo("pdf-editor")

    // Simulate PDF loading
    setTimeout(() => {
      setPdfLoaded(true)
    }, 1000)
  }

  const addAnnotation = (annotation: Omit<Annotation, "id">) => {
    const newAnnotation: Annotation = {
      ...annotation,
      id: Date.now().toString(),
    }
    setAnnotations((prev) => [...prev, newAnnotation])
  }

  const removeAnnotation = (annotationId: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== annotationId))
  }

  const savePDF = () => {
    if (!currentEditingFile) return

    setIsLoading(true)
    setTimeout(() => {
      const newOperation: FileOperation = {
        id: Date.now().toString(),
        fileName: currentEditingFile.file.name,
        operation: "edit",
        status: "completed",
        progress: 100,
        createdAt: new Date(),
        fileSize: currentEditingFile.file.size,
        outputFileName: `edited_${currentEditingFile.file.name}`,
        downloadUrl: "#download",
      }

      setFileOperations((prev) => [newOperation, ...prev])
      setIsLoading(false)

      toast({
        title: "PDF saved successfully!",
        description: "Your edited PDF is ready for download.",
      })

      // Navigate back to tools after saving
      navigateTo("tools")
    }, 2000)
  }

  // Process files function
  const processFiles = async (operation: string) => {
    if (selectedFiles.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select files to process.",
        variant: "destructive",
      })
      return
    }

    // Only require multiple files for merge operation
    if (operation === "merge" && selectedFiles.length < 2) {
      toast({
        title: "Multiple files required",
        description: "Please select at least 2 files to merge.",
        variant: "destructive",
      })
      return
    }

    const premiumOperations = ["ocr", "batch-convert", "advanced-edit", "digital-signature"]
    if (premiumOperations.includes(operation) && (!user || user.plan === "free")) {
      toast({
        title: "Premium feature",
        description: "This feature requires a premium subscription.",
        variant: "destructive",
      })
      navigateTo("pricing")
      return
    }

    if (user?.plan === "free" && fileOperations.length >= 3) {
      toast({
        title: "Daily limit reached",
        description: "Free users can process up to 3 files per day.",
        variant: "destructive",
      })
      navigateTo("pricing")
      return
    }

    setIsLoading(true)

    try {
      for (const selectedFile of selectedFiles) {
        const newOperation: FileOperation = {
          id: Date.now().toString() + Math.random(),
          fileName: selectedFile.file.name,
          operation,
          status: "processing",
          progress: 0,
          createdAt: new Date(),
          fileSize: selectedFile.file.size,
          outputFileName: generateOutputFileName(selectedFile.file.name, operation),
        }

        setFileOperations((prev) => [newOperation, ...prev])

        const processingTime = Math.min(Math.max((selectedFile.file.size / (1024 * 1024)) * 1000, 2000), 10000)
        const steps = 20

        for (let i = 0; i <= steps; i++) {
          await new Promise((resolve) => setTimeout(resolve, processingTime / steps))
          const progress = (i / steps) * 100
          setFileOperations((prev) => prev.map((op) => (op.id === newOperation.id ? { ...op, progress } : op)))
        }

        setFileOperations((prev) =>
          prev.map((op) =>
            op.id === newOperation.id
              ? {
                  ...op,
                  status: "completed",
                  progress: 100,
                  downloadUrl: `#download-${newOperation.id}`,
                }
              : op,
          ),
        )
      }

      toast({
        title: "Processing complete!",
        description: `${selectedFiles.length} file(s) processed successfully.`,
      })

      setSelectedFiles([])
    } catch (error) {
      toast({
        title: "Processing failed",
        description: "There was an error processing your files.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const generateOutputFileName = (originalName: string, operation: string): string => {
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "")
    const ext = originalName.split(".").pop()

    switch (operation) {
      case "pdf-to-word":
        return `${nameWithoutExt}.docx`
      case "pdf-to-excel":
        return `${nameWithoutExt}.xlsx`
      case "pdf-to-ppt":
        return `${nameWithoutExt}.pptx`
      case "pdf-to-image":
        return `${nameWithoutExt}.png`
      case "pdf-to-text":
        return `${nameWithoutExt}.txt`
      case "pdf-to-html":
        return `${nameWithoutExt}.html`
      case "to-pdf":
        return `${nameWithoutExt}.pdf`
      case "compress":
        return `${nameWithoutExt}_compressed.${ext}`
      case "merge":
        return `merged_document.pdf`
      default:
        return `${nameWithoutExt}_${operation}.${ext}`
    }
  }

  const downloadFile = (operation: FileOperation) => {
    toast({
      title: "Download started",
      description: `Downloading ${operation.outputFileName}...`,
    })

    // Simulate download
    const link = document.createElement("a")
    link.href = "#"
    link.download = operation.outputFileName || operation.fileName
    link.click()
  }

  // Header Component with Back Button
  const Header = () => (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex items-center">
          {currentView !== "home" && (
            <Button variant="ghost" size="sm" onClick={goBack} className="mr-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <button onClick={() => navigateTo("home")} className="mr-6 flex items-center space-x-2">
            <FileText className="h-6 w-6" />
            <span className="font-bold">PDFPro</span>
          </button>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <button onClick={() => navigateTo("tools")} className="transition-colors hover:text-foreground/80">
              Tools
            </button>
            <button onClick={() => navigateTo("pricing")} className="transition-colors hover:text-foreground/80">
              Pricing
            </button>
            <button onClick={() => navigateTo("faq")} className="transition-colors hover:text-foreground/80">
              FAQ
            </button>
          </nav>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <Button variant="ghost" size="sm" onClick={toggleDarkMode} className="mr-2">
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
          <nav className="flex items-center space-x-2">
            {user ? (
              <div className="flex items-center space-x-2">
                <Badge variant={user.plan === "premium" ? "default" : "secondary"}>{user.plan}</Badge>
                <Button variant="ghost" size="sm" onClick={() => navigateTo("dashboard")}>
                  <UserIcon className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" onClick={() => navigateTo("auth")}>
                  Sign In
                </Button>
                <Button size="sm" onClick={() => navigateTo("auth")}>
                  Get Started
                </Button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  )

  // PDF Editor Component
  const PDFEditor = () => {
    if (!currentEditingFile) {
      navigateTo("tools")
      return null
    }

    const currentPageData = pdfPages.find((p) => p.pageNumber === currentPage)
    const pageAnnotations = annotations.filter((a) => a.page === currentPage)

    const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (selectedTool === "select") return

      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      if (selectedTool === "text") {
        const text = prompt("Enter text:")
        if (text) {
          addAnnotation({
            type: "text",
            x,
            y,
            width: text.length * (fontSize * 0.6),
            height: fontSize + 4,
            text,
            color: selectedColor,
            fontSize,
            page: currentPage,
          })
        }
      } else if (selectedTool === "highlight") {
        addAnnotation({
          type: "highlight",
          x,
          y,
          width: 150,
          height: 20,
          color: selectedColor,
          page: currentPage,
        })
      } else if (selectedTool === "rectangle") {
        addAnnotation({
          type: "rectangle",
          x,
          y,
          width: 100,
          height: 60,
          color: selectedColor,
          page: currentPage,
        })
      } else if (selectedTool === "circle") {
        addAnnotation({
          type: "circle",
          x,
          y,
          width: 80,
          height: 80,
          color: selectedColor,
          page: currentPage,
        })
      }
    }

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if (selectedTool === "freehand") {
        setIsDrawing(true)
        const rect = e.currentTarget.getBoundingClientRect()
        setStartPos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        })
      }
    }

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDrawing && selectedTool === "freehand") {
        const rect = e.currentTarget.getBoundingClientRect()
        const currentPos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        }

        // Add a small line segment
        addAnnotation({
          type: "freehand",
          x: startPos.x,
          y: startPos.y,
          width: Math.abs(currentPos.x - startPos.x),
          height: Math.abs(currentPos.y - startPos.y),
          color: selectedColor,
          page: currentPage,
        })

        setStartPos(currentPos)
      }
    }

    const handleMouseUp = () => {
      setIsDrawing(false)
    }

    // PDF content for each page
    const getPdfContent = (pageNumber: number) => {
      switch (pageNumber) {
        case 1:
          return (
            <>
              <div className="mb-6">
                <h1 className="text-3xl font-bold mb-4 text-gray-900">{currentEditingFile.file.name}</h1>
                <div className="w-16 h-1 bg-blue-600 mb-6"></div>
              </div>

              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p className="text-lg">
                  <strong>
                    Page {currentPage} of {pdfPages.length}
                  </strong>
                </p>

                <p>
                  This is a preview of your PDF document. You can add various types of annotations using the tools in
                  the left panel.
                </p>

                <div className="bg-gray-50 p-4 rounded border-l-4 border-blue-500">
                  <h3 className="font-semibold mb-2">Available Tools:</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Text Tool - Click anywhere to add text</li>
                    <li>Highlight Tool - Add colored highlights</li>
                    <li>Rectangle Tool - Draw rectangular shapes</li>
                    <li>Circle Tool - Draw circular shapes</li>
                    <li>Freehand Tool - Draw freely with your mouse</li>
                  </ul>
                </div>

                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
                  dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
                </p>
              </div>
            </>
          )
        case 2:
          return (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-4 text-gray-900">Section 1: Introduction</h2>
                <div className="w-16 h-1 bg-green-600 mb-6"></div>
              </div>

              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  This is page {pageNumber} of your document. Each page can have different content and independent
                  annotations.
                </p>

                <p>
                  Nulla facilisi. Maecenas nec justo vitae nisi pharetra euismod. Cras bibendum erat ut sapien
                  condimentum, vel ultricies nunc ultricies. Proin auctor aliquam dolor, in mollis tellus tempor vel.
                </p>

                <div className="bg-green-50 p-4 rounded">
                  <h4 className="font-semibold mb-2">Important Note</h4>
                  <p>All annotations you add will be saved with the document when you click the "Save PDF" button.</p>
                </div>

                <p>
                  Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Sed at tortor
                  at tortor finibus lobortis eget eu magna. Mauris vel convallis eros.
                </p>
              </div>
            </>
          )
        case 3:
          return (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-4 text-gray-900">Section 2: Methods</h2>
                <div className="w-16 h-1 bg-purple-600 mb-6"></div>
              </div>

              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  This is page {pageNumber} of your document. You can navigate between pages using the page buttons in
                  the left panel.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded">
                    <h4 className="font-semibold">Method 1</h4>
                    <p className="text-sm">Detailed description of the first method</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded">
                    <h4 className="font-semibold">Method 2</h4>
                    <p className="text-sm">Detailed description of the second method</p>
                  </div>
                </div>

                <p>
                  Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Sed
                  euismod, urna eu tincidunt consectetur, nisi nisl aliquam nunc, eget aliquam nisl nunc sit amet nisl.
                </p>
              </div>
            </>
          )
        case 4:
          return (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-4 text-gray-900">Section 3: Results</h2>
                <div className="w-16 h-1 bg-amber-600 mb-6"></div>
              </div>

              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>This is page {pageNumber} of your document. You can add annotations to any page.</p>

                <div className="bg-amber-50 p-4 rounded border border-amber-200">
                  <h4 className="font-semibold mb-2">Results Summary</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Finding 1: Lorem ipsum dolor sit amet</li>
                    <li>Finding 2: Consectetur adipiscing elit</li>
                    <li>Finding 3: Sed do eiusmod tempor incididunt</li>
                  </ul>
                </div>

                <p>
                  Donec euismod, nisl eget ultricies ultricies, nisl nisl aliquam nisl, eget aliquam nisl nunc sit amet
                  nisl. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.
                </p>
              </div>
            </>
          )
        case 5:
          return (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-4 text-gray-900">Section 4: Conclusion</h2>
                <div className="w-16 h-1 bg-red-600 mb-6"></div>
              </div>

              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  This is the final page of your document. You can save your edited PDF using the "Save PDF" button.
                </p>

                <div className="bg-red-50 p-4 rounded">
                  <h4 className="font-semibold mb-2">Conclusion</h4>
                  <p>
                    In conclusion, this document demonstrates the PDF editing capabilities of PDFPro. You can add text,
                    highlights, shapes, and freehand drawings to any page.
                  </p>
                </div>

                <p>
                  Thank you for using PDFPro! If you have any questions or feedback, please contact our support team.
                </p>
              </div>
            </>
          )
        default:
          return (
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p className="text-lg">
                <strong>
                  Page {currentPage} of {pdfPages.length}
                </strong>
              </p>
              <p>This is additional content for page {pageNumber}.</p>
            </div>
          )
      }
    }

    return (
      <div className="container py-4">
        <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-120px)]">
          {/* Toolbar */}
          <div className="lg:w-64 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={selectedTool === "select" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTool("select")}
                  >
                    <MousePointer className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={selectedTool === "text" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTool("text")}
                  >
                    <Type className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={selectedTool === "highlight" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTool("highlight")}
                  >
                    <Highlighter className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={selectedTool === "rectangle" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTool("rectangle")}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={selectedTool === "circle" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTool("circle")}
                  >
                    <Circle className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={selectedTool === "freehand" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedTool("freehand")}
                  >
                    <PenTool className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex gap-2 flex-wrap">
                    {["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff", "#00ffff", "#000000", "#888888"].map(
                      (color) => (
                        <button
                          key={color}
                          className={`w-6 h-6 rounded border-2 ${
                            selectedColor === color ? "border-gray-800 ring-2 ring-blue-500" : "border-gray-300"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setSelectedColor(color)}
                        />
                      ),
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Font Size: {fontSize}px</Label>
                  <Slider
                    value={[fontSize]}
                    onValueChange={(value) => setFontSize(value[0])}
                    min={8}
                    max={72}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Zoom: {zoomLevel}%</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setZoomLevel(Math.max(25, zoomLevel - 25))}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setZoomLevel(100)}>
                      100%
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setZoomLevel(Math.min(200, zoomLevel + 25))}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pdfPages.map((page) => (
                    <Button
                      key={page.id}
                      variant={currentPage === page.pageNumber ? "default" : "outline"}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setCurrentPage(page.pageNumber)}
                    >
                      Page {page.pageNumber}
                      {annotations.filter((a) => a.page === page.pageNumber).length > 0 && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {annotations.filter((a) => a.page === page.pageNumber).length}
                        </Badge>
                      )}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* PDF Viewer */}
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-auto">
            <div className="p-4 flex justify-center">
              {!pdfLoaded ? (
                <div className="flex items-center justify-center h-full w-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p>Loading PDF...</p>
                  </div>
                </div>
              ) : (
                <div
                  ref={pdfContainerRef}
                  className="bg-white shadow-2xl border relative"
                  style={{
                    width: `${(currentPageData?.width || 595) * (zoomLevel / 100)}px`,
                    height: `${(currentPageData?.height || 842) * (zoomLevel / 100)}px`,
                    transform: `scale(1)`,
                    transformOrigin: "top left",
                  }}
                >
                  {/* PDF Content Background */}
                  <div
                    className="absolute inset-0 p-8 text-gray-800 select-none pointer-events-none"
                    style={{ fontSize: `${12 * (zoomLevel / 100)}px` }}
                  >
                    {getPdfContent(currentPage)}
                  </div>

                  {/* Annotations Layer */}
                  {pageAnnotations.map((annotation) => (
                    <div
                      key={annotation.id}
                      className="absolute cursor-pointer group"
                      style={{
                        left: annotation.x * (zoomLevel / 100),
                        top: annotation.y * (zoomLevel / 100),
                        width: (annotation.width || 100) * (zoomLevel / 100),
                        height: (annotation.height || 20) * (zoomLevel / 100),
                        fontSize: (annotation.fontSize || 16) * (zoomLevel / 100),
                        color: annotation.color,
                        zIndex: 10,
                      }}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm("Remove this annotation?")) {
                          removeAnnotation(annotation.id)
                        }
                      }}
                    >
                      {annotation.type === "text" && (
                        <div
                          className="bg-white bg-opacity-90 px-2 py-1 rounded shadow-sm border border-gray-300"
                          style={{ color: annotation.color }}
                        >
                          {annotation.text}
                        </div>
                      )}

                      {annotation.type === "highlight" && (
                        <div
                          className="opacity-40 rounded"
                          style={{
                            backgroundColor: annotation.color,
                            width: "100%",
                            height: "100%",
                          }}
                        />
                      )}

                      {annotation.type === "rectangle" && (
                        <div
                          className="border-2 bg-transparent rounded"
                          style={{
                            borderColor: annotation.color,
                            width: "100%",
                            height: "100%",
                          }}
                        />
                      )}

                      {annotation.type === "circle" && (
                        <div
                          className="border-2 bg-transparent rounded-full"
                          style={{
                            borderColor: annotation.color,
                            width: "100%",
                            height: "100%",
                          }}
                        />
                      )}

                      {annotation.type === "freehand" && (
                        <div
                          className="rounded"
                          style={{
                            backgroundColor: annotation.color,
                            width: "100%",
                            height: "100%",
                            minWidth: "2px",
                            minHeight: "2px",
                          }}
                        />
                      )}

                      {/* Delete button on hover */}
                      <button
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeAnnotation(annotation.id)
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}

                  {/* Interactive Layer */}
                  <div
                    className="absolute inset-0 z-20"
                    style={{
                      cursor:
                        selectedTool === "select"
                          ? "default"
                          : selectedTool === "text"
                            ? "text"
                            : selectedTool === "freehand"
                              ? "crosshair"
                              : "crosshair",
                    }}
                    onClick={handleCanvasClick}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Properties Panel */}
          <div className="lg:w-64 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Document Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm space-y-2">
                  <div>
                    <strong>File:</strong>
                    <p className="text-gray-600 break-words">{currentEditingFile.file.name}</p>
                  </div>
                  <div>
                    <strong>Size:</strong> {(currentEditingFile.file.size / (1024 * 1024)).toFixed(2)} MB
                  </div>
                  <div>
                    <strong>Pages:</strong> {pdfPages.length}
                  </div>
                  <div>
                    <strong>Current Page:</strong> {currentPage}
                  </div>
                  <div>
                    <strong>Total Annotations:</strong> {annotations.length}
                  </div>
                </div>

                <div className="space-y-2">
                  <Button className="w-full" onClick={savePDF} disabled={isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    {isLoading ? "Saving..." : "Save PDF"}
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => navigateTo("tools")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Tools
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Page Annotations ({pageAnnotations.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {pageAnnotations.map((annotation, index) => (
                    <div
                      key={annotation.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm"
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: annotation.color }} />
                        <span className="capitalize">
                          {annotation.type} {index + 1}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAnnotation(annotation.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {pageAnnotations.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No annotations on this page</p>
                  )}
                </div>

                {pageAnnotations.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => {
                      const pageAnnotationIds = pageAnnotations.map((a) => a.id)
                      setAnnotations((prev) => prev.filter((a) => !pageAnnotationIds.includes(a.id)))
                    }}
                  >
                    Clear Page Annotations
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Home Page Component
  const HomePage = () => (
    <div className="flex flex-col min-h-screen">
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                Edit, Convert, and Manage PDFs with Ease
              </h1>
              <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                The ultimate PDF editor and file conversion platform. Edit PDFs, convert between formats, and manage
                your documents with professional-grade tools.
              </p>
            </div>
            <div className="space-x-4">
              <Button size="lg" onClick={() => navigateTo("tools")}>
                Get Started Free
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigateTo("pricing")}>
                View Pricing
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-50 dark:bg-gray-900">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Powerful PDF Tools</h2>
              <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                Everything you need to work with PDFs and convert files between formats.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl items-center gap-6 py-12 lg:grid-cols-3 lg:gap-12">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigateTo("tools")}>
              <CardHeader>
                <Edit3 className="h-10 w-10 mb-2" />
                <CardTitle>PDF Editor</CardTitle>
                <CardDescription>
                  Edit text, add annotations, merge, split, and compress PDFs with ease.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigateTo("tools")}>
              <CardHeader>
                <FileSpreadsheet className="h-10 w-10 mb-2" />
                <CardTitle>File Converter</CardTitle>
                <CardDescription>
                  Convert PDFs to Word, Excel, PowerPoint, images, and many other formats.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigateTo("pricing")}>
              <CardHeader>
                <Shield className="h-10 w-10 mb-2" />
                <CardTitle>Secure & Private</CardTitle>
                <CardDescription>
                  Your files are processed securely and deleted automatically after 24 hours.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Trusted by Millions</h2>
              <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                Join over 1 million users who trust PDFPro for their document needs.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
              <div className="flex flex-col items-center space-y-2">
                <Users className="h-12 w-12 text-blue-600" />
                <h3 className="text-2xl font-bold">1M+</h3>
                <p className="text-gray-500">Active Users</p>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <FileText className="h-12 w-12 text-green-600" />
                <h3 className="text-2xl font-bold">10M+</h3>
                <p className="text-gray-500">Files Processed</p>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <Star className="h-12 w-12 text-yellow-600" />
                <h3 className="text-2xl font-bold">4.9/5</h3>
                <p className="text-gray-500">User Rating</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )

  // Authentication Component
  const AuthPage = () => {
    const [isSignUp, setIsSignUp] = useState(false)
    const [formData, setFormData] = useState({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    })

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      setIsLoading(true)

      try {
        await new Promise((resolve) => setTimeout(resolve, 1000))

        if (isSignUp) {
          if (formData.password !== formData.confirmPassword) {
            throw new Error("Passwords do not match")
          }
          const newUser: AppUser = {
            id: Date.now().toString(),
            email: formData.email,
            name: formData.name,
            plan: "free",
          }
          setUser(newUser)
          if (typeof window !== "undefined") {
            localStorage.setItem("user", JSON.stringify(newUser))
          }
          toast({
            title: "Account created successfully!",
            description: "Welcome to PDFPro. You can now access all free features.",
          })
        } else {
          const existingUser: AppUser = {
            id: Date.now().toString(),
            email: formData.email,
            name: formData.email.split("@")[0],
            plan: "free",
          }
          setUser(existingUser)
          if (typeof window !== "undefined") {
            localStorage.setItem("user", JSON.stringify(existingUser))
          }
          toast({
            title: "Signed in successfully!",
            description: "Welcome back to PDFPro.",
          })
        }
        navigateTo("dashboard")
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Something went wrong",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    return (
      <div className="container flex items-center justify-center min-h-screen py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{isSignUp ? "Create Account" : "Sign In"}</CardTitle>
            <CardDescription>
              {isSignUp ? "Create your account to access premium features" : "Sign in to your account to continue"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Processing..." : isSignUp ? "Create Account" : "Sign In"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-blue-600 hover:underline"
              >
                {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Tools Page Component
  const ToolsPage = () => {
    const [activeTab, setActiveTab] = useState("pdf-editor")
    const [dragActive, setDragActive] = useState(false)

    const handleDrag = (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.type === "dragenter" || e.type === "dragover") {
        setDragActive(true)
      } else if (e.type === "dragleave") {
        setDragActive(false)
      }
    }

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)

      const files = e.dataTransfer.files
      if (files && files.length > 0) {
        addFiles(files)
      }
    }

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        addFiles(files)
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }

    const triggerFileInput = () => {
      if (fileInputRef.current) {
        fileInputRef.current.click()
      }
    }

    const FileUploadArea = () => (
      <div className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer hover:border-blue-400 ${
            dragActive ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-gray-300 dark:border-gray-700"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <div className="space-y-2">
            <p className="text-lg font-medium">
              {selectedFiles.length > 0 ? `${selectedFiles.length} file(s) selected` : "Drop your files here"}
            </p>
            <p className="text-sm text-gray-500">or click to browse files</p>
            <div className="flex justify-center">
              <Button variant="outline" type="button" onClick={triggerFileInput}>
                Browse Files
              </Button>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileInputChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.bmp,.txt,.html,.md"
          multiple
        />

        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Selected Files ({selectedFiles.length})</h3>
              <Button variant="outline" size="sm" onClick={clearAllFiles}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {selectedFiles.map((selectedFile) => (
                <div
                  key={selectedFile.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {selectedFile.preview ? (
                      <img
                        src={selectedFile.preview || "/placeholder.svg"}
                        alt="Preview"
                        className="h-10 w-10 object-cover rounded"
                      />
                    ) : (
                      <FileText className="h-10 w-10 text-blue-500" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{selectedFile.file.name}</p>
                      <p className="text-xs text-gray-500">{(selectedFile.file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {selectedFile.file.type === "application/pdf" && (
                      <Button size="sm" onClick={() => openPDFEditor(selectedFile)}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => removeFile(selectedFile.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )

    const PDFEditorTools = () => (
      <div className="space-y-6">
        <FileUploadArea />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Button
            onClick={() => {
              if (selectedFiles.length === 0) {
                toast({
                  title: "No files selected",
                  description: "Please select a PDF file to annotate.",
                  variant: "destructive",
                })
                return
              }

              // Find the first PDF file
              const pdfFile = selectedFiles.find((file) => file.file.type === "application/pdf")
              if (pdfFile) {
                openPDFEditor(pdfFile)
              } else {
                toast({
                  title: "No PDF files",
                  description: "Please select a PDF file to annotate.",
                  variant: "destructive",
                })
              }
            }}
            className="h-20 flex-col"
            disabled={selectedFiles.length === 0 || isLoading}
          >
            <Edit3 className="h-6 w-6 mb-2" />
            Annotate
          </Button>
          <Button
            onClick={() => processFiles("merge")}
            className="h-20 flex-col"
            disabled={selectedFiles.length < 2 || isLoading}
          >
            <Merge className="h-6 w-6 mb-2" />
            Merge PDFs
            {selectedFiles.length < 2 && <span className="text-xs mt-1">Need 2+ files</span>}
          </Button>
          <Button
            onClick={() => processFiles("split")}
            className="h-20 flex-col"
            disabled={selectedFiles.length === 0 || isLoading}
          >
            <Split className="h-6 w-6 mb-2" />
            Split
          </Button>
          <Button
            onClick={() => processFiles("compress")}
            className="h-20 flex-col"
            disabled={selectedFiles.length === 0 || isLoading}
          >
            <Compress className="h-6 w-6 mb-2" />
            Compress
          </Button>
          <Button
            onClick={() => processFiles("rotate")}
            className="h-20 flex-col"
            disabled={selectedFiles.length === 0 || isLoading}
          >
            <RotateCw className="h-6 w-6 mb-2" />
            Rotate
          </Button>
          <Button
            onClick={() => processFiles("encrypt")}
            className="h-20 flex-col"
            disabled={selectedFiles.length === 0 || isLoading}
          >
            <Lock className="h-6 w-6 mb-2" />
            Encrypt
          </Button>
          <Button
            onClick={() => processFiles("decrypt")}
            className="h-20 flex-col"
            disabled={selectedFiles.length === 0 || isLoading}
          >
            <Unlock className="h-6 w-6 mb-2" />
            Decrypt
          </Button>
          <Button
            onClick={() => processFiles("ocr")}
            className="h-20 flex-col"
            variant={!user || user.plan === "free" ? "outline" : "default"}
            disabled={selectedFiles.length === 0 || isLoading}
          >
            <Type className="h-6 w-6 mb-2" />
            OCR
            {(!user || user.plan === "free") && (
              <Badge variant="secondary" className="text-xs mt-1">
                Premium
              </Badge>
            )}
          </Button>
        </div>
      </div>
    )

    const FileConverter = () => (
      <div className="space-y-6">
        <FileUploadArea />
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Convert to:</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <Button
              onClick={() => processFiles("pdf-to-word")}
              className="h-20 flex-col"
              disabled={selectedFiles.length === 0 || isLoading}
            >
              <FileText className="h-6 w-6 mb-2" />
              Word (.docx)
            </Button>
            <Button
              onClick={() => processFiles("pdf-to-excel")}
              className="h-20 flex-col"
              disabled={selectedFiles.length === 0 || isLoading}
            >
              <FileSpreadsheet className="h-6 w-6 mb-2" />
              Excel (.xlsx)
            </Button>
            <Button
              onClick={() => processFiles("pdf-to-ppt")}
              className="h-20 flex-col"
              disabled={selectedFiles.length === 0 || isLoading}
            >
              <Presentation className="h-6 w-6 mb-2" />
              PowerPoint (.pptx)
            </Button>
            <Button
              onClick={() => processFiles("pdf-to-image")}
              className="h-20 flex-col"
              disabled={selectedFiles.length === 0 || isLoading}
            >
              <ImageIcon className="h-6 w-6 mb-2" />
              Image (.png)
            </Button>
            <Button
              onClick={() => processFiles("pdf-to-text")}
              className="h-20 flex-col"
              disabled={selectedFiles.length === 0 || isLoading}
            >
              <Type className="h-6 w-6 mb-2" />
              Text (.txt)
            </Button>
            <Button
              onClick={() => processFiles("pdf-to-html")}
              className="h-20 flex-col"
              disabled={selectedFiles.length === 0 || isLoading}
            >
              <Globe className="h-6 w-6 mb-2" />
              HTML (.html)
            </Button>
            <Button
              onClick={() => processFiles("pdf-to-epub")}
              className="h-20 flex-col"
              disabled={selectedFiles.length === 0 || isLoading}
            >
              <BookOpen className="h-6 w-6 mb-2" />
              ePub (.epub)
            </Button>
            <Button
              onClick={() => processFiles("to-pdf")}
              className="h-20 flex-col"
              disabled={selectedFiles.length === 0 || isLoading}
            >
              <FileText className="h-6 w-6 mb-2" />
              To PDF
            </Button>
          </div>
        </div>
      </div>
    )

    return (
      <div className="container py-8">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">PDF Tools & Converter</h1>
            <p className="text-gray-500">Edit PDFs and convert files between different formats</p>
            {user?.plan === "free" && (
              <p className="text-sm text-orange-600">
                Free plan: {Math.max(0, 3 - fileOperations.length)} operations remaining today
              </p>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pdf-editor">PDF Editor</TabsTrigger>
              <TabsTrigger value="converter">File Converter</TabsTrigger>
            </TabsList>
            <TabsContent value="pdf-editor">
              <PDFEditorTools />
            </TabsContent>
            <TabsContent value="converter">
              <FileConverter />
            </TabsContent>
          </Tabs>

          {isLoading && (
            <Card>
              <CardHeader>
                <CardTitle>Processing Files...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span>Please wait while we process your files.</span>
                </div>
              </CardContent>
            </Card>
          )}

          {fileOperations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Operations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {fileOperations.slice(0, 10).map((operation) => (
                    <div key={operation.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{operation.fileName}</p>
                        <p className="text-sm text-gray-500 capitalize">{operation.operation.replace("-", " ")}</p>
                        {operation.status === "processing" && <Progress value={operation.progress} className="mt-2" />}
                        {operation.status === "completed" && operation.outputFileName && (
                          <p className="text-sm text-green-600">Output: {operation.outputFileName}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {operation.status === "completed" && (
                          <Button size="sm" onClick={() => downloadFile(operation)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        )}
                        <Badge
                          variant={
                            operation.status === "completed"
                              ? "default"
                              : operation.status === "processing"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {operation.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    )
  }

  // Pricing Page Component
  const PricingPage = () => {
    const handleSubscribe = (plan: string) => {
      if (!user) {
        navigateTo("auth")
        return
      }

      toast({
        title: "Redirecting to payment...",
        description: "You will be redirected to Stripe for secure payment processing.",
      })

      setTimeout(() => {
        const updatedUser = { ...user, plan: "premium" as const }
        setUser(updatedUser)
        if (typeof window !== "undefined") {
          localStorage.setItem("user", JSON.stringify(updatedUser))
        }
        toast({
          title: "Subscription activated!",
          description: "Welcome to PDFPro Premium. Enjoy unlimited access to all features.",
        })
        navigateTo("dashboard")
      }, 2000)
    }

    return (
      <div className="container py-12">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-bold">Choose Your Plan</h1>
          <p className="text-xl text-gray-500">Start free, upgrade when you need more power</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="relative">
            <CardHeader>
              <CardTitle className="text-2xl">Free</CardTitle>
              <CardDescription>Perfect for occasional use</CardDescription>
              <div className="text-3xl font-bold">
                $0<span className="text-lg font-normal">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  Basic PDF editing tools
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  Convert PDF to Word, Excel, Image
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  Merge up to 2 PDFs
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  File size limit: 10MB
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />3 operations per day
                </li>
                <li className="flex items-center">
                  <X className="h-5 w-5 text-red-500 mr-2" />
                  OCR (text recognition)
                </li>
                <li className="flex items-center">
                  <X className="h-5 w-5 text-red-500 mr-2" />
                  Batch processing
                </li>
              </ul>
              <Button className="w-full" variant="outline" onClick={() => navigateTo("tools")}>
                Get Started Free
              </Button>
            </CardContent>
          </Card>

          <Card className="relative border-blue-500">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-blue-500">Most Popular</Badge>
            </div>
            <CardHeader>
              <CardTitle className="text-2xl">Premium</CardTitle>
              <CardDescription>For professionals and power users</CardDescription>
              <div className="text-3xl font-bold">
                $9.99<span className="text-lg font-normal">/month</span>
              </div>
              <p className="text-sm text-gray-500">or $99.99/year (save 17%)</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  All PDF editing tools
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  Convert to/from all formats
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  Unlimited merging & splitting
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  File size limit: 100MB
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  Unlimited operations
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  OCR (text recognition)
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  Batch processing
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  Priority support
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-2" />
                  Cloud storage integration
                </li>
              </ul>
              <Button className="w-full" onClick={() => handleSubscribe("premium")}>
                Upgrade to Premium
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-500">
            All plans include secure file processing and automatic file deletion after 24 hours.
          </p>
        </div>
      </div>
    )
  }

  // Dashboard Component
  const Dashboard = () => {
    if (!user) {
      navigateTo("auth")
      return null
    }

    return (
      <div className="container py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Welcome back, {user.name}!</h1>
              <p className="text-gray-500">
                You&apos;re on the {user.plan} plan
                {user.plan === "premium" && user.subscriptionEnd && (
                  <span> (expires {user.subscriptionEnd.toLocaleDateString()})</span>
                )}
              </p>
            </div>
            {user.plan === "free" && (
              <Button onClick={() => navigateTo("pricing")}>
                <Zap className="h-4 w-4 mr-2" />
                Upgrade to Premium
              </Button>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" onClick={() => navigateTo("tools")}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit PDF
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigateTo("tools")}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Convert Files
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => navigateTo("tools")}>
                  <Merge className="h-4 w-4 mr-2" />
                  Merge PDFs
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <History className="h-5 w-5 mr-2" />
                  Recent Files
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fileOperations.length > 0 ? (
                  <div className="space-y-2">
                    {fileOperations.slice(0, 3).map((operation) => (
                      <div key={operation.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{operation.fileName}</span>
                        <Badge variant="outline">{operation.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No recent files</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Account
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm">
                  <p>
                    <strong>Email:</strong> {user.email}
                  </p>
                  <p>
                    <strong>Plan:</strong> {user.plan}
                  </p>
                </div>
                {user.plan === "premium" ? (
                  <Button variant="outline" size="sm" className="w-full">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Manage Subscription
                  </Button>
                ) : (
                  <Button size="sm" className="w-full" onClick={() => navigateTo("pricing")}>
                    <Zap className="h-4 w-4 mr-2" />
                    Upgrade Plan
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Usage Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Usage This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{fileOperations.length}</div>
                  <div className="text-sm text-gray-500">Files Processed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {fileOperations.filter((op) => op.operation.includes("convert")).length}
                  </div>
                  <div className="text-sm text-gray-500">Conversions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {fileOperations.filter((op) => op.operation.includes("merge")).length}
                  </div>
                  <div className="text-sm text-gray-500">Merges</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {fileOperations.filter((op) => op.status === "completed").length}
                  </div>
                  <div className="text-sm text-gray-500">Completed</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // FAQ Page Component
  const FAQPage = () => (
    <div className="container py-12">
      <div className="max-w-3xl mx-auto">
        <div className="text-center space-y-4 mb-12">
          <h1 className="text-4xl font-bold">Frequently Asked Questions</h1>
          <p className="text-xl text-gray-500">Find answers to common questions about PDFPro</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <HelpCircle className="h-5 w-5 mr-2" />
                Is my data secure?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                Yes, absolutely. All files are processed securely using industry-standard encryption. Your files are
                automatically deleted from our servers after 24 hours, and we never store or share your personal
                documents.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What file formats do you support?</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                We support a wide range of formats including PDF, Word (.doc, .docx), Excel (.xls, .xlsx), PowerPoint
                (.ppt, .pptx), images (.jpg, .png, .gif), text files (.txt), HTML, and many more. Our universal
                converter can handle most common file types.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What&apos;s the difference between free and premium?</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                Free users get access to basic PDF editing tools and conversions with a 10MB file size limit and 3
                operations per day. Premium users get unlimited access to all tools, 100MB file size limit, OCR
                capabilities, batch processing, and priority support.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Can I cancel my subscription anytime?</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                Yes, you can cancel your premium subscription at any time. You&apos;ll continue to have access to
                premium features until the end of your billing period, after which your account will revert to the free
                plan.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Do you offer refunds?</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                We offer a 30-day money-back guarantee for all premium subscriptions. If you&apos;re not satisfied with
                our service, contact our support team within 30 days of your purchase for a full refund.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )

  // Main render logic
  const renderCurrentView = () => {
    switch (currentView) {
      case "home":
        return <HomePage />
      case "auth":
        return <AuthPage />
      case "tools":
        return <ToolsPage />
      case "pricing":
        return <PricingPage />
      case "dashboard":
        return <Dashboard />
      case "faq":
        return <FAQPage />
      case "pdf-editor":
        return <PDFEditor />
      default:
        return <HomePage />
    }
  }

  return (
    <div className={`min-h-screen ${darkMode ? "dark" : ""}`}>
      <Header />
      <main>{renderCurrentView()}</main>

      {/* Footer */}
      <footer className="border-t bg-gray-50 dark:bg-gray-900">
        <div className="container py-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <FileText className="h-6 w-6" />
                <span className="font-bold">PDFPro</span>
              </div>
              <p className="text-sm text-gray-500">The ultimate PDF editor and file conversion platform.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Tools</h3>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>
                  <button onClick={() => navigateTo("tools")}>PDF Editor</button>
                </li>
                <li>
                  <button onClick={() => navigateTo("tools")}>File Converter</button>
                </li>
                <li>
                  <button onClick={() => navigateTo("tools")}>Merge PDF</button>
                </li>
                <li>
                  <button onClick={() => navigateTo("tools")}>Split PDF</button>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>
                  <button onClick={() => navigateTo("pricing")}>Pricing</button>
                </li>
                <li>
                  <button onClick={() => navigateTo("faq")}>FAQ</button>
                </li>
                <li>
                  <a href="#" className="hover:underline">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:underline">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>
                  <a href="#" className="hover:underline">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:underline">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:underline">
                    Cookie Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} PDFPro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
