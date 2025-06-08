"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  X,
  Sun,
  Moon,
  UserIcon,
  LogOut,
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
  canvas?: HTMLCanvasElement
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
  const [drawingAnnotation, setDrawingAnnotation] = useState<Annotation | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pdfContainerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
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

      // Load PDF.js script
      const script = document.createElement("script")
      script.src = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"
      script.async = true
      document.body.appendChild(script)

      return () => {
        document.body.removeChild(script)
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
  const openPDFEditor = async (file: SelectedFile) => {
    setCurrentEditingFile(file)
    setPdfLoaded(false)
    setAnnotations([])
    setPdfPages([])
    setCurrentPage(1)
    navigateTo("pdf-editor")

    try {
      // Load PDF.js if not already loaded
      if (!(window as any).pdfjsLib) {
        ;(window as any).pdfjsLib = await import("pdfjs-dist/build/pdf")
        ;(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
      }

      const pdfjsLib = (window as any).pdfjsLib

      // Load the PDF file
      const loadingTask = pdfjsLib.getDocument(file.url)
      const pdf = await loadingTask.promise

      // Create pages array
      const pagesArray: PDFPage[] = []

      // Load first page immediately
      const page = await pdf.getPage(1)
      const viewport = page.getViewport({ scale: 1.0 })

      pagesArray.push({
        id: `page-1`,
        pageNumber: 1,
        width: viewport.width,
        height: viewport.height,
        rotation: 0,
      })

      setPdfPages(pagesArray)
      setPdfLoaded(true)

      // Load remaining pages in background
      const pagePromises = []
      for (let i = 2; i <= pdf.numPages; i++) {
        pagePromises.push(loadPdfPage(pdf, i))
      }

      const remainingPages = await Promise.all(pagePromises)
      setPdfPages([...pagesArray, ...remainingPages])
    } catch (error) {
      console.error("Error loading PDF:", error)
      toast({
        title: "Error loading PDF",
        description: "There was a problem loading your PDF file.",
        variant: "destructive",
      })
      navigateTo("tools")
    }
  }

  const loadPdfPage = async (pdf: any, pageNumber: number) => {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1.0 })

    return {
      id: `page-${pageNumber}`,
      pageNumber: pageNumber,
      width: viewport.width,
      height: viewport.height,
      rotation: 0,
    }
  }

  const renderPdfPage = async (pageNumber: number) => {
    if (!currentEditingFile || !pdfLoaded) return

    try {
      const pdfjsLib = (window as any).pdfjsLib
      const pdf = await pdfjsLib.getDocument(currentEditingFile.url).promise
      const page = await pdf.getPage(pageNumber)

      const canvas = canvasRef.current
      if (!canvas) return

      const viewport = page.getViewport({ scale: zoomLevel / 100 })
      canvas.width = viewport.width
      canvas.height = viewport.height

      const renderContext = {
        canvasContext: canvas.getContext("2d"),
        viewport: viewport,
      }

      await page.render(renderContext).promise
    } catch (error) {
      console.error("Error rendering PDF page:", error)
    }
  }

  useEffect(() => {
    if (currentView === "pdf-editor" && pdfLoaded && currentPage) {
      renderPdfPage(currentPage)
    }
  }, [currentView, pdfLoaded, currentPage, zoomLevel])

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
    }, 1000)
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

        const processingTime = Math.min(Math.max((selectedFile.file.size / (1024 * 1024)) * 500, 1000), 5000)
        const steps = 10

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

    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if (selectedTool === "select") return

      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      setStartPos({ x, y })
      setIsDrawing(true)

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
        setIsDrawing(false)
      } else if (selectedTool === "highlight" || selectedTool === "rectangle" || selectedTool === "circle") {
        // Create a temporary annotation that will be updated during mouse move
        const newAnnotation: Annotation = {
          id: "temp-" + Date.now().toString(),
          type: selectedTool as any,
          x,
          y,
          width: 0,
          height: 0,
          color: selectedColor,
          page: currentPage,
        }
        setDrawingAnnotation(newAnnotation)
      } else if (selectedTool === "freehand") {
        addAnnotation({
          type: "freehand",
          x,
          y,
          width: 2,
          height: 2,
          color: selectedColor,
          page: currentPage,
        })
      }
    }

    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDrawing || selectedTool === "select" || selectedTool === "text") return

      const rect = e.currentTarget.getBoundingClientRect()
      const currentX = e.clientX - rect.left
      const currentY = e.clientY - rect.top

      if (selectedTool === "freehand") {
        // Add a new point for freehand drawing
        addAnnotation({
          type: "freehand",
          x: currentX,
          y: currentY,
          width: 2,
          height: 2,
          color: selectedColor,
          page: currentPage,
        })
      } else if (drawingAnnotation) {
        // Update the temporary annotation dimensions
        setDrawingAnnotation({
          ...drawingAnnotation,
          width: Math.abs(currentX - startPos.x),
          height: Math.abs(currentY - startPos.y),
          x: Math.min(startPos.x, currentX),
          y: Math.min(startPos.y, currentY),
        })
      }
    }

    const handleCanvasMouseUp = () => {
      if (!isDrawing) return

      setIsDrawing(false)

      // Add the final annotation if we have a temporary one
      if (drawingAnnotation) {
        if (drawingAnnotation.width > 5 || drawingAnnotation.height > 5) {
          addAnnotation({
            type: drawingAnnotation.type,
            x: drawingAnnotation.x,
            y: drawingAnnotation.y,
            width: drawingAnnotation.width,
            height: drawingAnnotation.height,
            color: drawingAnnotation.color,
            page: currentPage,
          })
        }
        setDrawingAnnotation(null)
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
                <div className="relative">
                  {/* PDF Canvas */}
                  <div
                    className="bg-white shadow-lg mx-auto relative"
                    style={{
                      width: currentPageData ? currentPageData.width * (zoomLevel / 100) : 595,
                      height: currentPageData ? currentPageData.height * (zoomLevel / 100) : 842,
                    }}
                  >
                    <canvas ref={canvasRef} className="absolute top-0 left-0" />

                    {/* Annotations Layer */}
                    <div
                      className="absolute top-0 left-0 w-full h-full"
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseLeave={handleCanvasMouseUp}
                      style={{
                        cursor: selectedTool === "select" ? "default" : selectedTool === "text" ? "text" : "crosshair",
                      }}
                    >
                      {/* Existing Annotations */}
                      {pageAnnotations.map((annotation) => (
                        <div
                          key={annotation.id}
                          className="absolute cursor-pointer group"
                          style={{
                            left: annotation.x,
                            top: annotation.y,
                            width: annotation.width || 0,
                            height: annotation.height || 0,
                            zIndex: 10,
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (selectedTool === "select") {
                              if (confirm("Remove this annotation?")) {
                                removeAnnotation(annotation.id)
                              }
                            }
                          }}
                        >
                          {annotation.type === "text" && (
                            <div
                              className="bg-white bg-opacity-90 px-2 py-1 rounded shadow-sm border border-gray-300"
                              style={{
                                color: annotation.color,
                                fontSize: annotation.fontSize,
                              }}
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
                          {selectedTool === "select" && (
                            <button
                              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeAnnotation(annotation.id)
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Drawing Annotation (preview while drawing) */}
                      {drawingAnnotation && (
                        <div
                          className="absolute"
                          style={{
                            left: drawingAnnotation.x,
                            top: drawingAnnotation.y,
                            width: drawingAnnotation.width || 0,
                            height: drawingAnnotation.height || 0,
                            zIndex: 20,
                          }}
                        >
                          {drawingAnnotation.type === "highlight" && (
                            <div
                              className="opacity-40 rounded"
                              style={{
                                backgroundColor: drawingAnnotation.color,
                                width: "100%",
                                height: "100%",
                              }}
                            />
                          )}

                          {drawingAnnotation.type === "rectangle" && (
                            <div
                              className="border-2 bg-transparent rounded"
                              style={{
                                borderColor: drawingAnnotation.color,
                                width: "100%",
                                height: "100%",
                              }}
                            />
                          )}

                          {drawingAnnotation.type === "circle" && (
                            <div
                              className="border-2 bg-transparent rounded-full"
                              style={{
                                borderColor: drawingAnnotation.color,
                                width: "100%",
                                height: "100%",
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
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
                  description: "Please select a PDF file to edit.",
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
                  description: "Please select a PDF file to edit.",
                  variant: "destructive",
                })
              }
            }}
            className="h-20 flex-col"
            disabled={isLoading}
          >
            <Edit3 className="h-6 w-6 mb-2" />
            Edit PDF
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

  // Main render logic
  const renderCurrentView = () => {
    switch (currentView) {
      case "pdf-editor":
        return <PDFEditor />
      case "tools":
        return <ToolsPage />
      default:
        return <ToolsPage />
    }
  }

  return (
    <div className={`min-h-screen ${darkMode ? "dark" : ""}`}>
      <Header />
      <main>{renderCurrentView()}</main>
    </div>
  )
}
