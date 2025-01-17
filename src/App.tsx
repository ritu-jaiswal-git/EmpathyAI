import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import { Label } from "./components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card"
import { Alert, AlertDescription } from "./components/ui/alert"
import { Send, Camera, Mic, Play, Download, ArrowLeft, ThumbsUp, ThumbsDown } from 'lucide-react'
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth'
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'
import { app, db } from './firebase'
import axios from 'axios'
import * as faceapi from 'face-api.js'

const auth = getAuth(app)

axios.defaults.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
axios.defaults.headers.common['Content-Type'] = 'application/json'

interface ChatMessage {
  id: string
  text: string
  sender: 'user' | 'ai'
  timestamp: Timestamp
  emotion?: string
}

interface ErrorState {
  type: 'auth' | 'chat' | 'camera' | 'audio' | 'firebase'
  message: string
}

const useMultiStepForm = (steps: number) => {
  const [currentStep, setCurrentStep] = useState(0)
  const next = () => setCurrentStep((i) => (i < steps - 1 ? i + 1 : i))
  const back = () => setCurrentStep((i) => (i > 0 ? i - 1 : i))
  return { currentStep, setCurrentStep, next, back }
}

const AnimatedText = ({ text }: { text: string }) => {
  return (
    <motion.span
      initial={{ width: 0 }}
      animate={{ width: '100%' }}
      transition={{ duration: 2, ease: 'easeInOut' }}
      className="inline-block overflow-hidden whitespace-nowrap"
    >
      {text}
    </motion.span>
  )
}

const EmpathyLogo = () => (
  <svg 
    width="60" 
    height="60" 
    viewBox="0 0 60 60" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="EmpathyAI Logo"
  >
    <circle cx="30" cy="30" r="29" stroke="currentColor" strokeWidth="2"/>
    <circle cx="20" cy="20" r="4" fill="currentColor"/>
    <circle cx="40" cy="20" r="4" fill="currentColor"/>
    <path 
      d="M15 40C15 40 22.5 50 30 50C37.5 50 45 40 45 40" 
      stroke="currentColor" 
      strokeWidth="4" 
      strokeLinecap="round" 
      strokeDasharray="4 4"
    />
  </svg>
)

export default function Component() {
  const { currentStep, setCurrentStep } = useMultiStepForm(7)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [detectedEmotion, setDetectedEmotion] = useState<string | null>(null)
  const [transcribedText, setTranscribedText] = useState<string>('')
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("Auth state changed:", currentUser?.email)
      setUser(currentUser)
      if (currentUser) {
        setCurrentStep(4)
        setupChatListener(currentUser.uid)
      }
    })
    return () => unsubscribe()
  }, [setCurrentStep])

  useEffect(() => {
    const loadModels = async () => {
      try {
        const modelPath = '/models'
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
          faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
          faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
          faceapi.nets.faceExpressionNet.loadFromUri(modelPath)
        ])
        console.log('Face-api models loaded successfully')
      } catch (error) {
        console.error('Error loading face-api models:', error)
        setError({
          type: 'camera',
          message: 'Failed to load facial recognition models. Please refresh the page.'
        })
      }
    }

    loadModels()
  }, [])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages])

  const setupChatListener = (userId: string) => {
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', userId),
      orderBy('timestamp', 'asc')
    )

    return onSnapshot(q, 
      (snapshot) => {
        const newMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ChatMessage[]

        // Filter out AI messages to prevent duplicates
        const filteredMessages = newMessages.filter((message, index, self) =>
          message.sender === 'user' || 
          (message.sender === 'ai' && index === self.findIndex(m => m.id === message.id))
        )

        setChatMessages(filteredMessages)
      },
      (error) => {
        console.error('Chat listener error:', error)
        setError({
          type: 'firebase',
          message: 'Lost connection to chat. Please refresh the page.'
        })
      }
    )
  }

  const pageVariants = {
    initial: { opacity: 0, x: '100%' },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: '-100%' }
  }

  const pageTransition = {
    type: 'tween',
    ease: 'anticipate',
    duration: 0.5
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      setEmail('')
      setPassword('')
    } catch (error) {
      console.error('Login error:', error)
      setError({
        type: 'auth',
        message: 'Failed to sign in. Please check your credentials.'
      })
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      await addDoc(collection(db, 'users'), {
        uid: userCredential.user.uid,
        name,
        email,
        phone,
        createdAt: Timestamp.now()
      })
      setEmail('')
      setPassword('')
      setName('')
      setPhone('')
    } catch (error) {
      console.error('Signup error:', error)
      setError({
        type: 'auth',
        message: 'Failed to create account. Please try again.'
      })
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      setChatMessages([])
      setCurrentStep(0)
    } catch (error) {
      console.error('Signout error:', error)
      setError({
        type: 'auth',
        message: 'Failed to sign out. Please try again.'
      })
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newMessage.trim() || isProcessing) return

    const messageText = newMessage.trim()
    setNewMessage('')
    setIsProcessing(true)

    try {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      await addDoc(collection(db, 'chats'), {
        id: messageId,
        userId: user.uid,
        text: messageText,
        sender: 'user',
        timestamp: Timestamp.now(),
        emotion: detectedEmotion
      })

      const response = await axios.post('/chat', {
        user_id: user.uid,
        text: messageText,
        chat_id: messageId,
        emotion: detectedEmotion
      })

      if (response.data?.response) {
        const aiMessageId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        
        // Check if the AI response already exists
        const aiMessageExists = chatMessages.some(msg => msg.text === response.data.response && msg.sender === 'ai')
        
        if (!aiMessageExists) {
          await addDoc(collection(db, 'chats'), {
            id: aiMessageId,
            userId: user.uid,
            text: response.data.response,
            sender: 'ai',
            timestamp: Timestamp.now()
          })
        }
      }
    } catch (error) {
      console.error('Message send error:', error)
      setError({
        type: 'chat',
        message: 'Failed to send message. Please try again.'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleStartFacialRecognition = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      })
      
      setCameraStream(stream)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          startEmotionDetection()
        }
      }
    } catch (error) {
      console.error('Camera access error:', error)
      setError({
        type: 'camera',
        message: 'Failed to access camera. Please check your permissions.'
      })
    }
  }

  const handleStopFacialRecognition = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
      setDetectedEmotion(null)
    }
  }

  const startEmotionDetection = async () => {
    if (!videoRef.current) return

    const video = videoRef.current
    const canvas = faceapi.createCanvasFromMedia(video)
    const container = video.parentElement
    if (!container) return

    container.appendChild(canvas)
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'

    const displaySize = { 
      width: video.videoWidth, 
      height: video.videoHeight 
    }
    faceapi.matchDimensions(canvas, displaySize)

    const interval = setInterval(async () => {
      if (!video || !canvas) return

      try {
        const detections = await faceapi.detectAllFaces(
          video,
          new faceapi.TinyFaceDetectorOptions()
        )
        .withFaceLandmarks()
        .withFaceExpressions()

        if (detections.length > 0) {
          const resizedDetections = faceapi.resizeResults(detections, displaySize)
          canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)

          faceapi.draw.drawDetections(canvas, resizedDetections)
          faceapi.draw.drawFaceLandmarks(canvas, resizedDetections)
          faceapi.draw.drawFaceExpressions(canvas, resizedDetections)

          const expressions = detections[0].expressions
          const dominantEmotion = Object.entries(expressions).reduce((a, b) =>
            a[1] > b[1] ? a : b
          )[0]
          setDetectedEmotion(dominantEmotion)
        }
      } catch (error) {
        console.error('Emotion detection error:', error)
      }
    }, 100)

    return () => {
      clearInterval(interval)
      canvas.remove()
    }
  }

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      const audioChunks: BlobPart[] = []

      mediaRecorder.addEventListener('dataavailable', (event) => {
        audioChunks.push(event.data)
      })

      mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
        setAudioBlob(audioBlob)
        const audioUrl = URL.createObjectURL(audioBlob)
        setAudioUrl(audioUrl)
        transcribeAudio(audioBlob)
      })

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Recording start error:', error)
      setError({
        type: 'audio',
        message: 'Failed to start recording. Please check your microphone permissions.'
      })
    }
  }

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }
  }

  const handlePlayAudio = () => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed
      audioRef.current.play()
    }
  }

  const handleDownloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement('a')
      a.href = audioUrl
      a.download = 'recording.wav'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed)
    if (audioRef.current) {
      audioRef.current.playbackRate = speed
    }
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'audio.wav')
      
      const response = await axios.post('/transcribe', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      if (response.data?.text) {
        setTranscribedText(response.data.text)
        setNewMessage(response.data.text)
        
        if (user) {
          const messageId = `transcribed_${Date.now()}`
          await addDoc(collection(db, 'chats'), {
            id: messageId,
            userId: user.uid,
            text: response.data.text,
            sender: 'user',
            timestamp: Timestamp.now(),
            emotion: 'transcribed'
          })

          const chatResponse = await axios.post('/chat', {
            user_id: user.uid,
            text: response.data.text,
            chat_id: messageId,
            emotion: 'transcribed'
          })

          if (chatResponse.data?.response) {
            const aiMessageId = `ai_${Date.now()}`
            await addDoc(collection(db, 'chats'), {
              id: aiMessageId,
              userId: user.uid,
              text: chatResponse.data.response,
              sender: 'ai',
              timestamp: Timestamp.now()
            })
          }
        }
      }
    } catch (error) {
      console.error('Transcription error:', error)
      setError({
        type: 'audio',
        message: 'Failed to transcribe audio. Please try again.'
      })
    }
  }

  const handleFeedback = async (messageId: string, rating: 'like' | 'dislike') => {
    try {
      await axios.post('/feedback', {
        message_id: messageId,
        rating: rating === 'like' ? 1 : -1
      })
    } catch (error) {
      console.error('Feedback error:', error)
    }
  }

  const getEmotionDescription = (emotion: string): string => {
    const descriptions: Record<string, string> = {
      happy: "I sense joy in your expression! Would you like to share what's bringing you happiness?",
      sad: "I notice you're feeling down. Would you like to talk about what's troubling you?",
      angry: "I can see that something's frustrating you. Would you like to discuss what's bothering you?",
      surprised: "You seem surprised! Has something unexpected caught your attention?",
      neutral: "You appear calm and composed. How are you feeling inside?",
      fearful: "I sense some anxiety or concern. Would you like to explore what's causing these feelings?",
      disgusted: "Something seems to be bothering you. Would you like to talk about what's causing this reaction?"
    }

    return descriptions[emotion.toLowerCase()] || 
      `I notice you're expressing ${emotion}. Would you like to talk about how you're feeling?`
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-200 via-purple-200 to-blue-200 font-sans">
      <AnimatePresence mode="wait">
        {error && (
          <Alert 
            className="fixed top-4 right-4 w-96 z-50 bg-destructive text-destructive-foreground"
            role="alert"
          >
            <AlertDescription>
              {error.message}
              <Button 
                className="absolute top-2 right-2" 
                variant="ghost" 
                size="sm"
                onClick={() => setError(null)}
              >
                ×
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {currentStep === 0 && (
          <motion.div
            key="welcome"
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="text-left max-w-3xl p-8 relative"
          >
            <div className="flex items-center justify-center mb-8">
              <EmpathyLogo />
              <h1 className="text-4xl font-bold ml-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
                EmpathyAI
              </h1>
            </div>
            <h2 className="font-['Poppins'] text-5xl mb-8 text-black text-center font-bold">
              <AnimatedText text="Welcome to EmpathyAI" />
            </h2>
            <div className="mb-8">
              <p className="text-lg text-gray-800 mb-4">
                EmpathyAI is your personal AI companion designed to enhance your emotional 
                intelligence and support your mental health journey. We offer a safe, 
                judgment-free space where you can express yourself freely.
              </p>
              <p className="text-lg text-gray-800 mb-4">
                Our key features include:
              </p>
              <ul className="list-disc list-inside text-gray-800 space-y-2 mb-4">
                <li>Empathetic conversations that adapt to your emotional state</li>
                <li>Real-time facial emotion recognition</li>
                <li>Voice recording and transcription</li>
                <li>Personalized emotional support</li>
              </ul>
            </div>
            <div className="flex justify-center">
              <Button 
                onClick={() => setCurrentStep(1)} 
                className="bg-gradient-to-r from-pink-500 to-violet-500 text-white px-8 py-3 rounded-full text-lg hover:from-pink-600 hover:to-violet-600 transition-all duration-200 shadow-md"
              >
                Get Started
              </Button>
            </div>
          </motion.div>
        )}

        {currentStep === 1 && (
          <motion.div
            key="auth-choice"
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="bg-white bg-opacity-90 p-8 rounded-lg shadow-lg w-80"
          >
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
              Welcome to EmpathyAI
            </h2>
            <div className="space-y-4">
              <Button 
                onClick={() => setCurrentStep(2)} 
                className="w-full bg-gradient-to-r from-pink-500 to-violet-500 text-white py-3 rounded-md text-lg hover:from-pink-600 hover:to-violet-600 transition-all duration-200 shadow-md"
              >
                Login
              </Button>
              <Button 
                onClick={() => setCurrentStep(3)} 
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 rounded-md text-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-md"
              >
                Sign Up
              </Button>
            </div>
          </motion.div>
        )}

        {currentStep === 2 && (
          <motion.div
            key="login"
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="bg-white bg-opacity-90 p-8 rounded-lg shadow-lg w-80"
          >
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
              Login to EmpathyAI
            </h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-pink-500 to-violet-500 text-white"
                disabled={isProcessing}
              >
                {isProcessing ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </motion.div>
        )}

        {currentStep === 3 && (
          <motion.div
            key="signup"
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="bg-white bg-opacity-90 p-8 rounded-lg shadow-lg w-80"
          >
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
              Sign Up for EmpathyAI
            </h2>
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                disabled={isProcessing}
              >
                {isProcessing ? 'Creating Account...' : 'Sign Up'}
              </Button>
            </form>
          </motion.div>
        )}

        {currentStep === 4 && (
          <motion.div
            key="main"
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="w-full max-w-6xl"
          >
            <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-8">
              <header className="flex items-center justify-between mb-12">
                <div className="flex items-center space-x-2">
                  <EmpathyLogo />
                  <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
                    EmpathyAI
                  </h1>
                </div>
                <Button variant="outline" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </header>

              <main className="flex flex-col items-center">
                <h2 className="text-4xl font-bold text-center mb-12 text-gray-800">
                  Choose your Interaction
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 w-full max-w-4xl">
                  <Button
                    onClick={() => setCurrentStep(5)}
                    className="h-40 text-2xl font-semibold bg-gradient-to-br from-pink-200 to-purple-200 text-gray-800 hover:bg-opacity-90 transition-all duration-200 rounded-2xl shadow-lg"
                  >
                    Chat
                  </Button>
                  <Button
                    onClick={() => setCurrentStep(7)}
                    className="h-40 text-2xl font-semibold bg-gradient-to-br from-pink-200 to-purple-200 text-gray-800 hover:bg-opacity-90 transition-all duration-200 rounded-2xl shadow-lg"
                  >
                    Voice Recording
                  </Button>
                </div>
                <Button
                  onClick={() => setCurrentStep(6)}
                  className="h-40 w-full max-w-4xl text-2xl font-semibold bg-gradient-to-br from-pink-200 to-purple-200 text-gray-800 hover:bg-opacity-90 transition-all duration-200 rounded-2xl shadow-lg"
                >
                  Facial Emotion Detection
                </Button>
              </main>
            </div>
          </motion.div>
        )}

        {currentStep === 5 && (
          <motion.div
            key="chat"
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="w-full max-w-4xl"
          >
            <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-8">
              <header className="flex flex-col items-center justify-between mb-12">
                <h1 className="text-4xl font-bold text-black mb-6">Chat with EmpathyAI</h1>
                <Button variant="outline" onClick={() => setCurrentStep(4)} className="w-32">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>
              </header>

              <main className="bg-white bg-opacity-80 rounded-2xl shadow-lg p-6">
                <div className="h-[calc(100vh-300px)] overflow-y-auto mb-4">
                  {chatMessages.map((message) => (
                    <div 
                      key={message.id} 
                      className={`mb-4 ${message.sender === 'user' ? 'text-right' : ''}`}
                    >
                      <div 
                        className={`inline-block p-3 rounded-lg ${
                          message.sender === 'user' 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-200 text-gray-800'
                        } max-w-3/4`}
                      >
                        <p>{message.text}</p>
                        {message.emotion && (
                          <p className="text-xs mt-1 italic">
                            Detected emotion: {message.emotion}
                          </p>
                        )}
                        {message.sender === 'ai' && (
                          <div className="mt-2 flex justify-end space-x-2">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleFeedback(message.id, 'like')}
                            >
                              <ThumbsUp className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleFeedback(message.id, 'dislike')}
                            >
                              <ThumbsDown className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                  <Input
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-grow"
                    disabled={isProcessing}
                  />
                  <Button type="submit" size="icon" disabled={isProcessing}>
                    <Send className="h-4 w-4" />
                    <span className="sr-only">Send message</span>
                  </Button>
                </form>
              </main>
            </div>
          </motion.div>
        )}

        {currentStep === 6 && (
          <motion.div
            key="facial-recognition"
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="w-full max-w-4xl"
          >
            <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-8">
              <header className="flex flex-col items-center justify-between mb-12">
                <h1 className="text-4xl font-bold text-black mb-6">
                  Facial Emotion Detection
                </h1>
                <Button variant="outline" onClick={() => setCurrentStep(4)} className="w-32">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>
              </header>

              <main className="space-y-8">
                <div className="aspect-w-16 aspect-h-9 mb-4 relative">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="rounded-lg object-cover w-full h-full"
                  />
                </div>
                {cameraStream ? (
                  <Button 
                    className="w-full mb-8" 
                    onClick={handleStopFacialRecognition}
                  >
                    Stop Camera
                  </Button>
                ) : (
                  <Button 
                    className="w-full mb-8" 
                    onClick={handleStartFacialRecognition}
                  >
                    Start Camera
                  </Button>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white bg-opacity-80 rounded-2xl shadow-lg p-6">
                    <h2 className="text-2xl font-semibold mb-4">Facial Analysis</h2>
                    <p className="text-gray-600">
                      {detectedEmotion
                        ? getEmotionDescription(detectedEmotion)
                        : 'No emotion detected. Please ensure your face is visible to the camera.'}
                    </p>
                  </div>
                  <div className="bg-white bg-opacity-80 rounded-2xl shadow-lg p-6">
                    <h2 className="text-2xl font-semibold mb-4">Chat</h2>
                    <div className="h-60 overflow-y-auto mb-4">
                      {chatMessages.map((message) => (
                        <div 
                          key={message.id} 
                          className={`mb-2 ${message.sender === 'user' ? 'text-right' : ''}`}
                        >
                          <p className={`inline-block p-2 rounded-lg ${
                            message.sender === 'user' 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-200 text-gray-800'
                          }`}>
                            {message.text}
                          </p>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                      <Input
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-grow"
                        disabled={isProcessing}
                      />
                      <Button type="submit" size="icon" disabled={isProcessing}>
                        <Send className="h-4 w-4" />
                        <span className="sr-only">Send message</span>
                      </Button>
                    </form>
                  </div>
                </div>
              </main>
            </div>
          </motion.div>
        )}

        {currentStep === 7 && (
          <motion.div
            key="voice-recording"
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="w-full max-w-4xl"
          >
            <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-8">
              <header className="flex flex-col items-center justify-between mb-12">
                <h1 className="text-4xl font-bold text-black mb-6">
                  Voice Recording
                </h1>
                <Button variant="outline" onClick={() => setCurrentStep(4)} className="w-32">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>
              </header>

              <main className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <div 
                  className="w-64 h-64 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center cursor-pointer mb-8 shadow-lg hover:shadow-xl transition-all duration-200"
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                >
                  <div className="w-56 h-56 rounded-full bg-white bg-opacity-30 flex items-center justify-center">
                    <Mic className={`h-24 w-24 text-white ${isRecording ? 'animate-pulse' : ''}`} />
                  </div>
                </div>

                {audioUrl && (
                  <div className="space-y-4 w-full max-w-md">
                    <audio 
                      ref={audioRef} 
                      src={audioUrl} 
                      className="w-full" 
                      controls 
                    />
                    <div className="flex justify-between">
                      <Button onClick={handlePlayAudio}>
                        <Play className="mr-2 h-4 w-4" /> Play
                      </Button>
                      <Button onClick={handleDownloadAudio}>
                        <Download className="mr-2 h-4 w-4" /> Download
                      </Button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Playback Speed:</span>
                      <div className="space-x-2">
                        {[1, 1.5, 1.7, 2].map((speed) => (
                          <Button
                            key={speed}
                            variant={playbackSpeed === speed ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleSpeedChange(speed)}
                          >
                            {speed}x
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {transcribedText && (
                  <Card className="mt-8 w-full max-w-md">
                    <CardHeader>
                      <CardTitle>Transcribed Text</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>{transcribedText}</p>
                    </CardContent>
                  </Card>
                )}

                <div className="mt-8 w-full max-w-md">
                  <h2 className="text-2xl font-semibold mb-4">Chat based on Recording</h2>
                  <div className="bg-white bg-opacity-80 rounded-2xl shadow-lg p-6">
                    <div className="h-60 overflow-y-auto mb-4">
                      {chatMessages.map((message) => (
                        <div 
                          key={message.id} 
                          className={`mb-2 ${message.sender === 'user' ? 'text-right' : ''}`}
                        >
                          <p className={`inline-block p-2 rounded-lg ${
                            message.sender === 'user' 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-200 text-gray-800'
                          }`}>
                            {message.text}
                          </p>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                      <Input
                        placeholder="Type your message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="flex-grow"
                        disabled={isProcessing}
                      />
                      <Button type="submit" size="icon" disabled={isProcessing}>
                        <Send className="h-4 w-4" />
                        <span className="sr-only">Send message</span>
                      </Button>
                    </form>
                  </div>
                </div>
              </main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
