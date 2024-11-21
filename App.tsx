
import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from "./components/ui/button"
import { Input } from "./components/ui/input"
import { Label } from "./components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card"
import { Send, Camera, Mic, Play, Download, ArrowLeft } from 'lucide-react'
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth'
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'
import { app } from './firebase' // Make sure this import is correct

const auth = getAuth(app)
const db = getFirestore(app)

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Timestamp;
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
  <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="30" cy="30" r="29" stroke="black" strokeWidth="2"/>
    <circle cx="20" cy="20" r="4" fill="black"/>
    <circle cx="40" cy="20" r="4" fill="black"/>
    <path d="M15 40C15 40 22.5 50 30 50C37.5 50 45 40 45 40" stroke="black" strokeWidth="4" strokeLinecap="round" strokeDasharray="4 4"/>
  </svg>
)

function App() {
  const { currentStep, setCurrentStep } = useMultiStepForm(7) // Increased to 7 to include new pages
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const audioRef = useRef<HTMLAudioElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("Auth state changed:", currentUser)
      setUser(currentUser)
      if (currentUser) {
        setCurrentStep(4) // Go to main page if user is logged in
        // Subscribe to chat messages
        const q = query(
          collection(db, 'chats'),
          where('userId', '==', currentUser.uid),
          orderBy('timestamp', 'asc')
        )
        const unsubscribeChat = onSnapshot(q, (snapshot) => {
          const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as ChatMessage[]
          setChatMessages(messages)
        })
        return () => unsubscribeChat()
      }
    })
    return () => unsubscribe()
  }, [setCurrentStep])

  useEffect(() => {
    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
    return () => {
      document.head.removeChild(link)
    }
  }, [])

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
      console.log("Login successful")
      // Navigation is handled by the auth state observer
    } catch (error) {
      console.error('Error signing in:', error)
      setError('Failed to sign in. Please check your credentials.')
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      console.log("Sign up successful")
      await addDoc(collection(db, 'users'), {
        uid: userCredential.user.uid,
        name,
        email,
        phone
      })
      // Navigation is handled by the auth state observer
    } catch (error) {
      console.error('Error signing up:', error)
      setError('Failed to sign up. Please try again.')
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      setCurrentStep(0) // Go back to welcome page after signing out
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newMessage.trim()) return

    try {
      const newUserMessage: ChatMessage = {
        id: Date.now().toString(),
        text: newMessage,
        sender: 'user',
        timestamp: Timestamp.now()
      }
      setChatMessages(prevMessages => [...prevMessages, newUserMessage])
      setNewMessage('')

      await addDoc(collection(db, 'chats'), {
        userId: user.uid,
        text: newMessage,
        sender: 'user',
        timestamp: Timestamp.now()
      })

      // Here you would typically call your AI service to get a response
      // For this example, we'll just simulate an AI response
      setTimeout(async () => {
        const aiResponse: ChatMessage = {
          id: (Date.now() + 1).toString(),
          text: "I'm here to help. How can I assist you today?",
          sender: 'ai',
          timestamp: Timestamp.now()
        }
        setChatMessages(prevMessages => [...prevMessages, aiResponse])

        await addDoc(collection(db, 'chats'), {
          userId: user.uid,
          text: aiResponse.text,
          sender: 'ai',
          timestamp: Timestamp.now()
        })
      }, 1000)
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const handleStartFacialRecognition = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      setCameraStream(stream)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      alert('Failed to access the camera. Please check your permissions.')
    }
  }

  const handleStopFacialRecognition = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
      setCameraStream(null)
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
      })

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Failed to start recording. Please check your microphone permissions.')
    }
  }

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
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
      a.download = 'rant.wav'
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-200 via-purple-200 to-blue-200 font-sans">
      <AnimatePresence mode="wait">
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
                EmpathyAI is your personal AI companion designed to enhance your emotional intelligence and support your mental health journey. We offer a safe, judgment-free space where you can express yourself freely.
              </p>
              <p className="text-lg text-gray-800 mb-4">
                Our key features include:
              </p>
              <ul className="list-disc list-inside text-gray-800 space-y-2 mb-4">
                <li>Empathetic conversations that adapt to your emotional state</li>
                <li>Mood tracking and analysis</li>
                <li>Personalized coping strategies</li>
                <li>Facial emotion recognition</li>
              </ul>
              <p className="text-lg text-gray-800">
                Start your journey of self-discovery and emotional growth with EmpathyAI today.
              </p>
            </div>
            <div className="flex justify-center">
              <Button onClick={() => setCurrentStep(1)} className="bg-gradient-to-r from-pink-500 to-violet-500 text-white px-8 py-3 rounded-full text-lg hover:from-pink-600 hover:to-violet-600 transition-all duration-200 shadow-md">
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
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Welcome to EmpathyAI</h2>
            <div className="space-y-4">
              <Button onClick={() => setCurrentStep(2)} className="w-full bg-gradient-to-r from-pink-500 to-violet-500 text-white py-3 rounded-md text-lg hover:from-pink-600 hover:to-violet-600 transition-all duration-200 shadow-md">
                Login
              </Button>
              <Button onClick={() => setCurrentStep(3)} className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 rounded-md text-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-md">
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
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Login to EmpathyAI</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-gray-700">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full mt-1"
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-gray-700">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full mt-1"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <Button type="submit" className="w-full bg-gradient-to-r from-pink-500 to-violet-500 text-white py-2 rounded-md text-lg hover:from-pink-600 hover:to-violet-600 transition-all duration-200 shadow-md">
                Login
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
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Sign Up for EmpathyAI</h2>
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-gray-700">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full mt-1"
                />
              </div>
              <div>
                <Label htmlFor="email" className="text-gray-700">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full mt-1"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-gray-700">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full mt-1"
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-gray-700">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full mt-1"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <Button type="submit" className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2 rounded-md text-lg hover:from-blue-600 hover:to-purple-600 transition-all duration-200 shadow-md">
                Sign Up
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
                <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
              </header>

              <main className="flex flex-col items-center">
                <h2 className="text-4xl font-bold text-center mb-12 text-gray-800">Choose your Interaction</h2>
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
                    Rant
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
                <h1 className="text-4xl font-bold text-black mb-6">Ready when you are, What's up?</h1>
                <Button variant="outline" onClick={() => setCurrentStep(4)} className="w-32">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>
              </header>

              <main className="bg-white bg-opacity-80 rounded-2xl shadow-lg p-6">
                <div className="h-[calc(100vh-300px)] overflow-y-auto mb-4">
                  {chatMessages.map((message) => (
                    <div key={message.id} className={`mb-4 ${message.sender === 'user' ? 'text-right' : ''}`}>
                      <p className={`inline-block p-3 rounded-lg ${message.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
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
                  />
                  <Button type="submit" size="icon">
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
                <h1 className="text-4xl font-bold text-black mb-6">Your face is lowkey telling a story - let's see it!</h1>
                <Button variant="outline" onClick={() => setCurrentStep(4)} className="w-32">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>
              </header>

              <main className="space-y-8">
                <div className="aspect-w-16 aspect-h-9 mb-4">
                  {cameraStream ? (
                    <video ref={videoRef} autoPlay playsInline className="rounded-lg object-cover w-full h-full" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-gray-200 rounded-lg">
                      <Camera className="h-24 w-24 text-gray-400" />
                    </div>
                  )}
                </div>
                {cameraStream ? (
                  <Button className="w-full mb-8" onClick={handleStopFacialRecognition}>Stop Camera</Button>
                ) : (
                  <Button className="w-full mb-8" onClick={handleStartFacialRecognition}>Start Camera</Button>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white bg-opacity-80 rounded-2xl shadow-lg p-6">
                    <h2 className="text-2xl font-semibold mb-4">Facial Analysis</h2>
                    <p className="text-gray-600">Facial analysis results will appear here...</p>
                  </div>
                  <div className="bg-white bg-opacity-80 rounded-2xl shadow-lg p-6">
                    <h2 className="text-2xl font-semibold mb-4">Chat</h2>
                    <div className="h-60 overflow-y-auto mb-4">
                      {chatMessages.map((message) => (
                        <div key={message.id} className={`mb-2 ${message.sender === 'user' ? 'text-right' : ''}`}>
                          <p className={`inline-block p-2 rounded-lg ${message.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
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
                      />
                      <Button type="submit" size="icon">
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
            key="rant"
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="w-full max-w-4xl"
          >
            <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-8">
              <header className="flex flex-col items-center justify-between mb-12">
                <h1 className="text-4xl font-bold text-black mb-6">Because every rant tells a story.</h1>
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
                    <audio ref={audioRef} src={audioUrl} className="w-full" controls />
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
              </main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App