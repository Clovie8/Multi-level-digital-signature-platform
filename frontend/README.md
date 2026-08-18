# Digital Signature Platform - Frontend

This is the frontend client for the Digital Signature Platform, built with **React** and **Vite**. It provides a seamless, interactive experience for both document creators (Initiators) and document signers (Third Parties). 

## The E-Signature Workflow
1. **Upload & Prepare:** The Initiator uploads a PDF and drags signature/text fields onto the canvas.
2. **Dispatch:** The frontend sends the field coordinates to the backend and triggers automated routing emails.
3. **OTP Gateway:** The signer receives a secure link, enters a 6-digit OTP sent to their email, and unlocks the canvas.
4. **Sign & Seal:** The signer draws their signature. The frontend sends the Base64 image back to the backend, where it is cryptographically burned into the PDF.

## Key Features Built

### 1. The Creator Dashboard (`Dashboard.jsx`)
- **Drag & Drop Interface**: Built a full document preparation interface where creators can drag elements (Signatures, Initials, Dates, Text Boxes) directly onto the PDF canvas.
- **Dynamic Field Resizing**: Integrated `react-rnd` to allow creators to resize fields visually. These custom CSS dimensions are mathematically translated into absolute PDF points by the backend.
- **Multi-Level Routing**: Creators can assign different fields to different people and set up sequential routing orders (e.g., Level 1 signs first, then Level 2).

### 2. The Signer Canvas (`Sign.jsx`)
- **Zero-Trust Authentication Gateway**: Implemented a secure Email OTP (One-Time Password) wall. When a 3rd party signer clicks their email link, they cannot see the document until they request and verify a 6-digit code.
- **Interactive Signature Pad**: Integrated `react-signature-canvas` for smooth, responsive drawing of signatures. Signers can also type their name into cursive font if they prefer.
- **Signer-Side Resizing**: Signers have the ability to tweak the size of their assigned signature boxes before committing, ensuring their signature fits perfectly.
- **PDF Rendering**: Utilized `react-pdf` with PDF.js web workers to render the Cloudflare R2 documents crisply in the browser.

### 3. Modern Layout & Styling
- **Tailwind CSS**: Used Tailwind (v4) for rapid, responsive UI development.
- **Lucide Icons**: Integrated sleek, modern vector icons.
- **Interactive Micro-animations**: Added pulse effects for active fields, slide-in transitions for the properties panel, and toast notifications for a premium user feel.
  
### 4. Enterprise-Grade Security
- **HTTP-Only Cookies:** The frontend is configured to securely pass `withCredentials: true` via Axios, ensuring that authentication tokens are stored safely in the browser's cookie jar, protecting the app from Cross-Site Scripting (XSS) attacks.
- **Zero-Trust File Access:** The frontend never exposes raw Cloudflare R2 bucket URLs. Instead, it securely receives temporary, 1-hour pre-signed URLs from the backend only after the user passes the OTP gateway.

---

## Dependencies

Here is a breakdown of every dependency installed and exactly what it does in this project:

| Dependency | Purpose |
| :--- | :--- |
| **`react`** & **`react-dom`** | The core UI library powering the component-based architecture. |
| **`react-router-dom`** | Handles client-side routing (`/login`, `/`, `/sign/:token`). Includes route protection logic. |
| **`axios`** | Handles all HTTP requests (REST API calls) to the Node.js backend. |
| **`react-pdf`** | Renders the actual PDF pages inside the browser canvas. Used in both the Dashboard and the Signer view. |
| **`react-rnd`** | (Resizable and Draggable) Powers the interactive fields placed on the PDF. Allows users to drag fields around and resize them by dragging the corners. |
| **`react-signature-canvas`** | Provides the HTML5 Canvas drawing pad where users can physically draw their signature using a mouse or touch screen. |
| **`react-hot-toast`** | Provides the sleek popup notifications (success/error messages) seen in the top center of the screen. |
| **`lucide-react`** | The icon library providing crisp, scalable SVG icons (PenTool, CheckCircle, etc). |

### Development Dependencies
- **`vite`**: The blazing-fast build tool and development server.
- **`tailwindcss`** & **`@tailwindcss/postcss`**: The utility-first CSS framework and its PostCSS processor.
- **`eslint`**: Enforces code quality and catches errors during development.

---

##  How to Run Locally

Follow these steps to run the frontend on your local machine:

### 1. Prerequisites
- Ensure you have **Node.js** installed (v18 or higher recommended).
- The backend server must be running concurrently on port `5000` (or whatever is configured in the Axios calls).

### 2. Initiation and Installation
Navigate into the `frontend` directory and install the dependencies:
```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install react-router-dom axios react-pdf react-rnd react-signature-canvas react-hot-toast lucide-react
npm install -D tailwindcss @tailwindcss/vite
```

### 3. Start the Development Server
Run Vite's lightning-fast development server:
```bash
npm run dev
```

### 4. Access the App
Open your browser and navigate to the URL provided by Vite (typically `http://localhost:5173`).

---

##  Project Structure

- `/src/pages/Auth.jsx`: The login and registration flows.
- `/src/pages/Dashboard.jsx`: The document preparation arena (uploading PDFs, dragging fields, assigning signers).
- `/src/pages/Sign.jsx`: The secure portal where signers enter their OTP, view the document, and draw their signature.
- `/src/components/Layout.jsx`: The standard shell (Sidebar/Header) wrapping the protected routes.
- `/src/App.jsx`: The root routing configuration mapping URLs to components.


