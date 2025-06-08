"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import {
  FileText,
  Upload,
  Split,
  FileArchiveIcon as Compress,
  RotateCw,
  Lock,
  ImageIcon,
  FileSpreadsheet,
  Type,
  X,
  Sun,
  Moon,
  LogOut,
  Save,
  ZoomIn,
  ZoomOut,
  MousePointer,
  Square,
  Circle,
  PenTool,
  Highlighter,
  Undo2,
  Redo2,
  AlertCircle,
  Download,
  ChevronLeft,
  ChevronRight,
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
  type:
    | "text"
    | "highlight"
    | "rectangle"
    | "circle"
    | "arrow"
    | "freehand"
    | "underline"
    | "strikethrough"
    | "editText"
  x: number
  y: number
  width?: number
  height?: number
  text?: string
  color: string
  fontSize?: number
  page: number
  points?: { x: number; y: number }[]
  originalText?: string
}

interface PDFPage {
  id: string
  pageNumber: number
  width: number
  height: number
  rotation: number
  canvas?: HTMLCanvasElement
  textItems?: PDFTextItem[]
}

interface PDFTextItem {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
}

interface HistoryState {
  annotations: Annotation[]
}

// Main App Component
export default function PDFEditorPlatform() {
  const [currentView, setCurrentView] = useState("tools")
  const [previousView, setPreviousView] = useState("tools")
  const [user, setUser] = useState<AppUser | null>(null)
  const [darkMode, setDarkMode] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [fileOperations, setFileOperations] = useState<FileOperation[]>([])
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null)
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
  const [currentOperation, setCurrentOperation] = useState<string>("")
  const [editingTextAnnotation, setEditingTextAnnotation] = useState<Annotation | null>(null)
  const [history, setHistory] = useState<HistoryState[]>([{ annotations: [] }])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [textEditMode, setTextEditMode] = useState(false)
  const [selectedTextItem, setSelectedTextItem] = useState<PDFTextItem | null>(null)
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false)
  const [renderingPage, setRenderingPage] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [exportProgress, setExportProgress] = useState(0)
  const [pageRotation, setPageRotation] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pdfContainerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const textEditRef = useRef<HTMLTextAreaElement>(null)
  const pdfDocRef = useRef<any>(null)
  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  // Load PDF.js library
  useEffect(() => {
    if (typeof window === "undefined") return

    const loadPdfJs = async () => {
      try {
        // Check if PDF.js is already loaded
        if ((window as any).pdfjsLib) {
          setPdfLibLoaded(true)
          return
        }

        // Load PDF.js script
        const script = document.createElement("script")
        script.src = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"
        script.async = true

        script.onload = () => {
          if ((window as any).pdfjsLib) {
            ;(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
            setPdfLibLoaded(true)
            console.log("PDF.js loaded successfully")
          }
        }

        script.onerror = () => {
          console.error("Failed to load PDF.js")
          setErrorMessage("Failed to load PDF library. Please refresh the page.")
          toast({
            title: "Error loading PDF library",
            description: "Please refresh the page to try again.",
            variant: "destructive",
          })
        }

        document.head.appendChild(script)

        return () => {
          if (document.head.contains(script)) {
            document.head.removeChild(script)
          }
        }
      } catch (error) {
        console.error("Error loading PDF.js:", error)
        setErrorMessage("Error initializing PDF library. Please refresh the page.")
      }
    }

    loadPdfJs()
  }, [toast])

  // Initialize app
  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      // Check for saved user session
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
    } catch (error) {
      console.error("Error initializing app:", error)
    }
  }, [])

  const navigateTo = useCallback(
    (view: string) => {
      setPreviousView(currentView)
      setCurrentView(view)
    },
    [currentView],
  )

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const newMode = !prev
      if (typeof window !== "undefined") {
        if (newMode) {
          document.documentElement.classList.add("dark")
          localStorage.setItem("theme", "dark")
        } else {
          document.documentElement.classList.remove("dark")
          localStorage.setItem("theme", "light")
        }
      }
      return newMode
    })
  }, [])

  const handleSignOut = useCallback(() => {
    setUser(null)
    if (typeof window !== "undefined") {
      localStorage.removeItem("user")
    }
    navigateTo("tools")
    toast({
      title: "Signed out successfully",
      description: "You have been signed out of your account.",
    })
  }, [navigateTo, toast])

  // File handling functions
  const validateFile = useCallback(
    (file: File): boolean => {
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
    },
    [user?.plan, toast],
  )

  const createFilePreview = useCallback((file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.readAsDataURL(file)
      } else if (file.type === "application/pdf") {
        resolve("/placeholder.svg?height=100&width=100")
      } else {
        resolve("")
      }
    })
  }, [])

  // PDF Editor Functions
  const loadPdfDocument = useCallback(
    async (file: SelectedFile) => {
      if (!pdfLibLoaded) {
        toast({
          title: "PDF library not ready",
          description: "Please wait for the PDF library to load and try again.",
          variant: "destructive",
        })
        return
      }

      try {
        setErrorMessage(null)
        setRenderingPage(true)

        const pdfjsLib = (window as any).pdfjsLib
        if (!pdfjsLib) {
          throw new Error("PDF.js library not available")
        }

        console.log("Loading PDF document:", file.file.name)

        const loadingTask = pdfjsLib.getDocument({
          url: file.url,
          cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/",
          cMapPacked: true,
          enableXfa: true,
          disableRange: false,
          disableStream: false,
          disableAutoFetch: false,
        })

        const pdf = await loadingTask.promise
        pdfDocRef.current = pdf

        console.log(`PDF loaded with ${pdf.numPages} pages`)

        // Create pages array
        const pagesArray: PDFPage[] = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const viewport = page.getViewport({ scale: 1.0, rotation: 0 })

          let textItems: PDFTextItem[] = []
          try {
            const textContent = await page.getTextContent()
            textItems = textContent.items
              .filter((item: any) => item.str && item.str.trim())
              .map((item: any, index: number) => {
                const transform = item.transform || [1, 0, 0, 1, 0, 0]
                const x = transform[4]
                const y = viewport.height - transform[5]

                return {
                  id: `text-${i}-${index}`,
                  text: item.str,
                  x,
                  y,
                  width: item.width || item.str.length * 8,
                  height: item.fontSize || 12,
                  fontSize: item.fontSize || 12,
                  fontFamily: item.fontName || "sans-serif",
                }
              })
          } catch (textError) {
            console.warn("Could not extract text from page", i, textError)
          }

          pagesArray.push({
            id: `page-${i}`,
            pageNumber: i,
            width: viewport.width,
            height: viewport.height,
            rotation: 0,
            textItems,
          })
        }

        setPdfPages(pagesArray)
        setPdfLoaded(true)
        setCurrentPage(1)
        setRenderingPage(false)

        // Render first page immediately
        setTimeout(() => {
          renderPdfPage(1)
        }, 100)

        toast({
          title: "PDF loaded successfully",
          description: `${pdf.numPages} pages loaded and ready for editing.`,
        })
      } catch (error) {
        console.error("Error loading PDF document:", error)
        setErrorMessage("Error loading PDF. The file may be corrupted or password protected.")
        setRenderingPage(false)
        toast({
          title: "Error loading PDF",
          description: "There was a problem loading your PDF file.",
          variant: "destructive",
        })
      }
    },
    [pdfLibLoaded, toast],
  )

  const handleFileSelect = useCallback(
    async (files: FileList) => {
      if (files.length === 0) return

      const file = files[0]
      if (validateFile(file)) {
        try {
          setErrorMessage(null)
          const preview = await createFilePreview(file)
          const url = URL.createObjectURL(file)
          const newFile: SelectedFile = {
            file,
            preview,
            id: Date.now().toString(),
            url,
          }

          setSelectedFile(newFile)
          setCurrentEditingFile(newFile)

          // Reset state
          setHistory([{ annotations: [] }])
          setHistoryIndex(0)
          setAnnotations([])
          setPdfLoaded(false)
          setPdfPages([])
          setCurrentPage(1)
          setPageRotation(0)

          // Load PDF if it's a PDF file
          if (file.type === "application/pdf") {
            await loadPdfDocument(newFile)
          }

          toast({
            title: "File selected",
            description: `${file.name} is ready for editing.`,
          })
        } catch (error) {
          console.error("Error selecting file:", error)
          setErrorMessage("Error selecting file. Please try again with a different file.")
          toast({
            title: "Error selecting file",
            description: "There was a problem with the selected file.",
            variant: "destructive",
          })
        }
      }
    },
    [validateFile, createFilePreview, loadPdfDocument, toast],
  )

  const removeFile = useCallback(() => {
    try {
      if (selectedFile?.url) {
        URL.revokeObjectURL(selectedFile.url)
      }

      setSelectedFile(null)
      setCurrentEditingFile(null)
      setPdfLoaded(false)
      setPdfPages([])
      setAnnotations([])
      setCurrentPage(1)
      setHistory([{ annotations: [] }])
      setHistoryIndex(0)
      setPageRotation(0)
      setErrorMessage(null)

      if (pdfDocRef.current) {
        pdfDocRef.current = null
      }

      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current)
        renderTimeoutRef.current = null
      }
    } catch (error) {
      console.error("Error removing file:", error)
    }
  }, [selectedFile])

  const renderPdfPage = useCallback(
    async (pageNumber: number) => {
      if (!pdfDocRef.current || !canvasRef.current || renderingPage) {
        return
      }

      setRenderingPage(true)

      try {
        const pdf = pdfDocRef.current
        const page = await pdf.getPage(pageNumber)
        const canvas = canvasRef.current
        const context = canvas.getContext("2d")

        if (!context) {
          setRenderingPage(false)
          return
        }

        // Clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height)

        const viewport = page.getViewport({
          scale: zoomLevel / 100,
          rotation: pageRotation,
        })

        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = viewport.width + "px"
        canvas.style.height = viewport.height + "px"

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        }

        await page.render(renderContext).promise
        console.log(`PDF page ${pageNumber} rendered successfully`)
        setRenderingPage(false)
      } catch (error) {
        console.error("Error rendering PDF page:", error)
        setErrorMessage("Error rendering PDF page.")
        setRenderingPage(false)
      }
    },
    [zoomLevel, pageRotation, renderingPage],
  )

  // Render PDF when page changes
  useEffect(() => {
    if (pdfLoaded && currentPage && pdfDocRef.current && canvasRef.current) {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current)
      }

      renderTimeoutRef.current = setTimeout(() => {
        renderPdfPage(currentPage)
      }, 100)
    }

    return () => {
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current)
        renderTimeoutRef.current = null
      }
    }
  }, [pdfLoaded, currentPage, zoomLevel, pageRotation, renderPdfPage])

  const rotatePage = useCallback(() => {
    setPageRotation((prev) => (prev + 90) % 360)
  }, [])

  const addAnnotation = useCallback((annotation: Omit<Annotation, "id">) => {
    const newAnnotation: Annotation = {
      ...annotation,
      id: Date.now().toString() + Math.random(),
    }
    setAnnotations((prev) => [...prev, newAnnotation])
  }, [])

  const removeAnnotation = useCallback((annotationId: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== annotationId))
  }, [])

  // Undo/Redo functionality
  const addToHistory = useCallback(
    (newAnnotations: Annotation[]) => {
      setHistory((prev) => {
        const newHistory = [...prev.slice(0, historyIndex + 1), { annotations: [...newAnnotations] }]
        return newHistory
      })
      setHistoryIndex((prev) => prev + 1)
    },
    [historyIndex],
  )

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setAnnotations(history[newIndex].annotations)
    }
  }, [historyIndex, history])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setAnnotations(history[newIndex].annotations)
    }
  }, [historyIndex, history])

  // Process files function
  const processWithTool = useCallback(
    async (operation: string) => {
      if (!selectedFile) {
        toast({
          title: "No file selected",
          description: "Please select a file first.",
          variant: "destructive",
        })
        return
      }

      setCurrentOperation(operation)
      setIsLoading(true)
      setExportProgress(0)

      try {
        const newOperation: FileOperation = {
          id: Date.now().toString(),
          fileName: selectedFile.file.name,
          operation,
          status: "processing",
          progress: 0,
          createdAt: new Date(),
          fileSize: selectedFile.file.size,
          outputFileName: generateOutputFileName(selectedFile.file.name, operation),
        }

        setFileOperations((prev) => [newOperation, ...prev])

        // Simulate processing with progress
        for (let i = 0; i <= 100; i += 10) {
          await new Promise((resolve) => setTimeout(resolve, 200))
          setExportProgress(i)
          setFileOperations((prev) => prev.map((op) => (op.id === newOperation.id ? { ...op, progress: i } : op)))
        }

        // Create download blob
        const blob = new Blob([selectedFile.file], { type: selectedFile.file.type })
        const downloadUrl = URL.createObjectURL(blob)

        setFileOperations((prev) =>
          prev.map((op) =>
            op.id === newOperation.id
              ? {
                  ...op,
                  status: "completed",
                  progress: 100,
                  downloadUrl,
                }
              : op,
          ),
        )

        toast({
          title: `${operation} completed!`,
          description: `Your file has been processed successfully.`,
        })
      } catch (error) {
        console.error("Processing error:", error)
        setErrorMessage(`Error processing file with operation: ${operation}`)
        toast({
          title: "Processing failed",
          description: "There was an error processing your file.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
        setCurrentOperation("")
        setExportProgress(0)
      }
    },
    [selectedFile, toast],
  )

  const generateOutputFileName = useCallback((originalName: string, operation: string): string => {
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
      case "split":
        return `${nameWithoutExt}_split.pdf`
      case "rotate":
        return `${nameWithoutExt}_rotated.pdf`
      case "encrypt":
        return `${nameWithoutExt}_encrypted.pdf`
      case "decrypt":
        return `${nameWithoutExt}_decrypted.pdf`
      default:
        return `${nameWithoutExt}_${operation}.${ext}`
    }
  }, [])

  const downloadFile = useCallback(
    (operation: FileOperation) => {
      if (operation.downloadUrl) {
        const link = document.createElement("a")
        link.href = operation.downloadUrl
        link.download = operation.outputFileName || operation.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        toast({
          title: "Download started",
          description: `Downloading ${operation.outputFileName}...`,
        })
      }
    },
    [toast],
  )

  const savePDF = useCallback(() => {
    if (!currentEditingFile) return

    setIsLoading(true)
    setExportProgress(0)

    const simulateSaving = async () => {
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 200))
        setExportProgress(i)
      }

      const newOperation: FileOperation = {
        id: Date.now().toString(),
        fileName: currentEditingFile.file.name,
        operation: "edit",
        status: "completed",
        progress: 100,
        createdAt: new Date(),
        fileSize: currentEditingFile.file.size,
        outputFileName: `edited_${currentEditingFile.file.name}`,
        downloadUrl: currentEditingFile.url,
      }

      setFileOperations((prev) => [newOperation, ...prev])
      setIsLoading(false)
      setExportProgress(0)

      toast({
        title: "PDF saved successfully!",
        description: "Your edited PDF is ready for download.",
      })
    }

    simulateSaving()
  }, [currentEditingFile, toast])

  // Navigation functions
  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }, [currentPage])

  const goToNextPage = useCallback(() => {
    if (currentPage < pdfPages.length) {
      setCurrentPage(currentPage + 1)
    }
  }, [currentPage, pdfPages.length])

  // Header Component
  const Header = () => (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex items-center">
          <button onClick={() => navigateTo("tools")} className="mr-6 flex items-center space-x-2">
            <FileText className="h-6 w-6" />
            <span className="font-bold">PDFPro</span>
          </button>
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <button
              onClick={() => navigateTo("tools")}
              className={`transition-colors hover:text-foreground/80 ${
                currentView === "tools" ? "text-foreground" : "text-foreground/60"
              }`}
            >
              Tools
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
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
                <Button size="sm">Get Started</Button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  )

  // PDF Editor Component
  const PDFEditorWithTools = () => {
    const currentPageData = pdfPages.find((p) => p.pageNumber === currentPage)
    const pageAnnotations = annotations.filter((a) => a.page === currentPage)

    const handleCanvasMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()

        if (selectedTool === "select") return

        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        setStartPos({ x, y })
        setIsDrawing(true)

        if (selectedTool === "text") {
          const text = prompt("Enter text:")
          if (text && text.trim()) {
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
        } else if (["highlight", "rectangle", "circle", "underline", "strikethrough"].includes(selectedTool)) {
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
            width: 3,
            height: 3,
            color: selectedColor,
            page: currentPage,
            points: [{ x, y }],
          })
        }
      },
      [selectedTool, selectedColor, fontSize, currentPage, addAnnotation],
    )

    const handleCanvasMouseMove = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDrawing || selectedTool === "select" || selectedTool === "text") return

        const rect = e.currentTarget.getBoundingClientRect()
        const currentX = e.clientX - rect.left
        const currentY = e.clientY - rect.top

        if (selectedTool === "freehand") {
          addAnnotation({
            type: "freehand",
            x: currentX,
            y: currentY,
            width: 2,
            height: 2,
            color: selectedColor,
            page: currentPage,
            points: [{ x: currentX, y: currentY }],
          })
        } else if (drawingAnnotation) {
          setDrawingAnnotation({
            ...drawingAnnotation,
            width: Math.abs(currentX - startPos.x),
            height: Math.abs(currentY - startPos.y),
            x: Math.min(startPos.x, currentX),
            y: Math.min(startPos.y, currentY),
          })
        }
      },
      [isDrawing, selectedTool, selectedColor, currentPage, addAnnotation, drawingAnnotation, startPos],
    )

    const handleCanvasMouseUp = useCallback(() => {
      if (!isDrawing) return

      setIsDrawing(false)

      if (drawingAnnotation && (drawingAnnotation.width > 5 || drawingAnnotation.height > 5)) {
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
    }, [isDrawing, drawingAnnotation, currentPage, addAnnotation])

    return (
      <div className="container py-4">
        <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-120px)]">
          {/* Left Sidebar */}
          <div className="lg:w-80 space-y-4">
            {/* File Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select File</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedFile ? (
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm font-medium">Click to select a file</p>
                    <p className="text-xs text-gray-500">PDF, Word, Excel, PowerPoint, Images</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-medium text-sm">{selectedFile.file.name}</p>
                          <p className="text-xs text-gray-500">
                            {(selectedFile.file.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={removeFile}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Select Different File
                    </Button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.bmp,.txt,.html,.md"
                />
              </CardContent>
            </Card>

            {/* PDF Tools */}
            {selectedFile && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">PDF Tools</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => processWithTool("split")}
                      size="sm"
                      disabled={isLoading || selectedFile.file.type !== "application/pdf"}
                      className="h-16 flex-col"
                    >
                      <Split className="h-4 w-4 mb-1" />
                      Split
                    </Button>
                    <Button
                      onClick={() => processWithTool("compress")}
                      size="sm"
                      disabled={isLoading}
                      className="h-16 flex-col"
                    >
                      <Compress className="h-4 w-4 mb-1" />
                      Compress
                    </Button>
                    <Button
                      onClick={rotatePage}
                      size="sm"
                      disabled={isLoading || selectedFile.file.type !== "application/pdf" || !pdfLoaded}
                      className="h-16 flex-col"
                    >
                      <RotateCw className="h-4 w-4 mb-1" />
                      Rotate
                    </Button>
                    <Button
                      onClick={() => processWithTool("encrypt")}
                      size="sm"
                      disabled={isLoading || selectedFile.file.type !== "application/pdf"}
                      className="h-16 flex-col"
                    >
                      <Lock className="h-4 w-4 mb-1" />
                      Encrypt
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Conversion Tools */}
            {selectedFile && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Convert To</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => processWithTool("pdf-to-word")}
                      size="sm"
                      disabled={isLoading || selectedFile.file.type !== "application/pdf"}
                      className="h-16 flex-col"
                    >
                      <FileText className="h-4 w-4 mb-1" />
                      Word
                    </Button>
                    <Button
                      onClick={() => processWithTool("pdf-to-excel")}
                      size="sm"
                      disabled={isLoading || selectedFile.file.type !== "application/pdf"}
                      className="h-16 flex-col"
                    >
                      <FileSpreadsheet className="h-4 w-4 mb-1" />
                      Excel
                    </Button>
                    <Button
                      onClick={() => processWithTool("pdf-to-image")}
                      size="sm"
                      disabled={isLoading || selectedFile.file.type !== "application/pdf"}
                      className="h-16 flex-col"
                    >
                      <ImageIcon className="h-4 w-4 mb-1" />
                      Image
                    </Button>
                    <Button
                      onClick={() => processWithTool("to-pdf")}
                      size="sm"
                      disabled={isLoading || selectedFile.file.type === "application/pdf"}
                      className="h-16 flex-col"
                    >
                      <FileText className="h-4 w-4 mb-1" />
                      To PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Annotation Tools */}
            {selectedFile && selectedFile.file.type === "application/pdf" && pdfLoaded && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Annotation Tools</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
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

                  {/* Undo/Redo */}
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" size="sm" onClick={undo} disabled={historyIndex <= 0}>
                      <Undo2 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1}>
                      <Redo2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Color Picker */}
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

                  {/* Font Size */}
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

                  {/* Zoom Controls */}
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

                  <Button className="w-full" onClick={savePDF} disabled={isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    {isLoading ? "Saving..." : "Save PDF"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Page Navigation */}
            {selectedFile && selectedFile.file.type === "application/pdf" && pdfLoaded && pdfPages.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pages ({pdfPages.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <Button variant="outline" size="sm" onClick={goToPreviousPage} disabled={currentPage <= 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Page {currentPage} of {pdfPages.length}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextPage}
                      disabled={currentPage >= pdfPages.length}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
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
            )}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-auto">
            {/* Error Display */}
            {errorMessage && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-4 mb-4 rounded-md flex items-start">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium">Error</h4>
                  <p className="text-sm">{errorMessage}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setErrorMessage(null)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            {/* Progress Indicator */}
            {isLoading && exportProgress > 0 && (
              <div className="p-4">
                <div className="mb-2 flex justify-between text-sm">
                  <span>{currentOperation || "Processing"} in progress...</span>
                  <span>{Math.round(exportProgress)}%</span>
                </div>
                <Progress value={exportProgress} className="h-2" />
              </div>
            )}

            <div className="p-4 flex justify-center">
              {!selectedFile ? (
                <div className="flex items-center justify-center h-full w-full">
                  <div className="text-center">
                    <Upload className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                    <h3 className="text-xl font-medium mb-2">Select a file to get started</h3>
                    <p className="text-gray-500">Choose a PDF, Word, Excel, PowerPoint, or image file to edit</p>
                  </div>
                </div>
              ) : selectedFile.file.type === "application/pdf" ? (
                !pdfLoaded ? (
                  <div className="flex items-center justify-center h-full w-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p>Loading PDF...</p>
                      {!pdfLibLoaded && <p className="text-sm text-gray-500 mt-2">Loading PDF library...</p>}
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    {/* PDF Canvas Container */}
                    <div
                      className="bg-white shadow-lg mx-auto relative"
                      style={{
                        width: currentPageData ? currentPageData.width * (zoomLevel / 100) : 595,
                        height: currentPageData ? currentPageData.height * (zoomLevel / 100) : 842,
                        maxHeight: "calc(100vh - 200px)",
                      }}
                      ref={pdfContainerRef}
                    >
                      {/* PDF Canvas */}
                      <canvas ref={canvasRef} className="absolute top-0 left-0" />

                      {/* Annotations Layer */}
                      <div
                        className="absolute top-0 left-0 w-full h-full"
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                        style={{
                          cursor:
                            selectedTool === "select" ? "default" : selectedTool === "text" ? "text" : "crosshair",
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
                          </div>
                        ))}

                        {/* Drawing Preview */}
                        {drawingAnnotation && (
                          <div
                            className="absolute border-2 border-dashed"
                            style={{
                              left: drawingAnnotation.x,
                              top: drawingAnnotation.y,
                              width: drawingAnnotation.width,
                              height: drawingAnnotation.height,
                              borderColor: drawingAnnotation.color,
                              pointerEvents: "none",
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center h-full w-full">
                  <div className="text-center">
                    <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                    <h3 className="text-xl font-medium mb-2">File Preview</h3>
                    <p className="text-gray-500">
                      {selectedFile.file.name} - {selectedFile.file.type}
                    </p>
                    <p className="text-sm text-gray-400 mt-2">Use the tools on the left to process this file</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* File Operations History */}
        {fileOperations.length > 0 && (
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Operations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {fileOperations.slice(0, 5).map((operation) => (
                    <div
                      key={operation.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{operation.fileName}</p>
                          <p className="text-xs text-gray-500 capitalize">{operation.operation}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {operation.status === "processing" && (
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            <span className="text-sm">{operation.progress}%</span>
                          </div>
                        )}
                        {operation.status === "completed" && (
                          <Button size="sm" onClick={() => downloadFile(operation)} className="text-xs">
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        )}
                        {operation.status === "failed" && (
                          <Badge variant="destructive" className="text-xs">
                            Failed
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${darkMode ? "dark" : ""}`}>
      <Header />
      <main>
        <PDFEditorWithTools />
      </main>
    </div>
  )
}
