# PDFPro - Professional PDF Editor & File Conversion Platform

A comprehensive, full-stack web application for PDF editing, file conversion, and document management. Built with React, Next.js, Node.js, Express, and MongoDB.

## 🚀 Features

### PDF Editor Tools
- **Text & Image Editing**: Edit text and images directly in PDFs
- **Annotations**: Highlight, underline, strikethrough, add comments and shapes
- **Merge & Split**: Combine multiple PDFs or split into separate files
- **Compression**: Reduce PDF file sizes while maintaining quality
- **Page Management**: Rotate, reorder, or delete pages
- **Watermarks**: Add text or image watermarks
- **Security**: Add or remove passwords (encryption/decryption)
- **Form Filling**: Fill and sign PDF forms with digital signatures
- **Redaction**: Remove sensitive information securely
- **OCR**: Convert scanned PDFs to editable text (Premium)

### File Conversion
- **PDF to Other Formats**: Word, Excel, PowerPoint, Images, Text, HTML, ePub
- **Other Formats to PDF**: Word, Excel, PowerPoint, Images, Text, HTML, Markdown
- **Universal Converter**: Convert between any supported file formats
- **Batch Processing**: Convert multiple files simultaneously (Premium)

### User Management
- **Authentication**: Secure signup/signin with JWT tokens
- **Guest Mode**: Use basic features without registration
- **Password Recovery**: Email-based password reset
- **OAuth Integration**: Google/Apple sign-in support

### Subscription Plans
- **Free Plan**: Basic tools, 10MB limit, 3 operations/day
- **Premium Plan**: All features, 100MB limit, unlimited operations
- **Stripe Integration**: Secure payment processing
- **Subscription Management**: Upgrade, downgrade, cancel anytime

### Additional Features
- **Drag & Drop**: Intuitive file upload interface
- **Real-time Preview**: See changes before processing
- **Progress Tracking**: Visual progress bars for operations
- **File History**: Track recent conversions and edits
- **Cloud Integration**: Google Drive, Dropbox support (Premium)
- **Multi-language**: English, Spanish, French, German
- **Dark/Light Mode**: Theme toggle
- **Responsive Design**: Works on all devices
- **Security**: Files auto-deleted after 24 hours

## 🛠 Technology Stack

### Frontend
- **React 18** with TypeScript
- **Next.js 14** (App Router)
- **Tailwind CSS** for styling
- **shadcn/ui** components
- **Lucide React** icons
- **PDF.js** for PDF rendering

### Backend
- **Node.js** with Express
- **MongoDB** with Mongoose
- **JWT** authentication
- **Multer** for file uploads
- **PDFKit** for PDF generation
- **Sharp** for image processing
- **Stripe** for payments

### Development Tools
- **TypeScript** for type safety
- **ESLint** for code quality
- **Nodemon** for development
- **CORS** for cross-origin requests

## 📦 Installation & Setup

### Prerequisites
- Node.js 16+ 
- MongoDB (local or cloud)
- npm or yarn

### 1. Clone Repository
\`\`\`bash
git clone https://github.com/your-username/pdfpro-platform.git
cd pdfpro-platform
\`\`\`

### 2. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 3. Environment Variables
Create a `.env.local` file in the root directory:

\`\`\`env
# Database
MONGODB_URI=mongodb://localhost:27017/pdfpro

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key

# Email (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# File Storage (optional - for cloud storage)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=your-s3-bucket-name

# App Settings
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
\`\`\`

### 4. Start MongoDB
Make sure MongoDB is running on your system:
\`\`\`bash
# If using local MongoDB
mongod

# Or use MongoDB Atlas (cloud) - update MONGODB_URI accordingly
\`\`\`

### 5. Run the Application

#### Development Mode
\`\`\`bash
# Start the backend server
npm run server:dev

# In another terminal, start the frontend
npm run dev
\`\`\`

#### Production Mode
\`\`\`bash
# Build the frontend
npm run build

# Start both frontend and backend
npm start
npm run server
\`\`\`

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## 🔧 Configuration

### File Upload Limits
- Free users: 10MB per file
- Premium users: 100MB per file
- Supported formats: PDF, Word, Excel, PowerPoint, Images, Text, HTML

### Usage Limits
- Free users: 3 operations per day
- Premium users: Unlimited operations

### Security Features
- JWT token authentication
- Password hashing with bcrypt
- File validation and sanitization
- Automatic file cleanup after 24 hours
- Rate limiting on API endpoints

## 📁 Project Structure

\`\`\`
pdfpro-platform/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main application component
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/            # Reusable UI components
│   └── ui/               # shadcn/ui components
├── scripts/              # Backend server files
│   └── server.js         # Express server
├── public/               # Static assets
├── uploads/              # File upload directory
├── outputs/              # Processed file outputs
├── package.json          # Dependencies and scripts
├── README.md            # This file
└── .env.local           # Environment variables
\`\`\`

## 🚀 Deployment

### Frontend (Vercel)
1. Push code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically on push

### Backend (Heroku/Railway)
1. Create new app on Heroku or Railway
2. Set environment variables
3. Deploy from GitHub or CLI

### Database (MongoDB Atlas)
1. Create cluster on MongoDB Atlas
2. Update MONGODB_URI in environment variables
3. Configure network access and database users

## 🔒 Security Considerations

- All file uploads are validated and sanitized
- JWT tokens expire after 7 days
- Files are automatically deleted after 24 hours
- Rate limiting prevents abuse
- HTTPS required in production
- Environment variables for sensitive data
- Input validation on all endpoints

## 🧪 Testing

\`\`\`bash
# Run frontend tests
npm test

# Run backend tests
npm run test:server

# Run all tests
npm run test:all
\`\`\`

## 📊 Monitoring & Analytics

- Health check endpoint: `/api/health`
- User analytics tracking
- File processing metrics
- Error logging and monitoring
- Performance optimization

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- Email: support@pdfpro.com
- Documentation: https://docs.pdfpro.com
- Issues: https://github.com/your-username/pdfpro-platform/issues

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced OCR with AI
- [ ] Collaborative editing
- [ ] API for developers
- [ ] White-label solutions
- [ ] Advanced analytics dashboard

## 🙏 Acknowledgments

- [PDF.js](https://mozilla.github.io/pdf.js/) for PDF rendering
- [shadcn/ui](https://ui.shadcn.com/) for UI components
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Stripe](https://stripe.com/) for payment processing
- [MongoDB](https://www.mongodb.com/) for database
- [Vercel](https://vercel.com/) for hosting

---

Built with ❤️ by the PDFPro Team
