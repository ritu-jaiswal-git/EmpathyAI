

from fastapi import FastAPI, HTTPException, UploadFile, File 
from pydantic import BaseModel
from .response_generator import ResponseGenerator
import firebase_admin
from firebase_admin import credentials, firestore
import logging
from starlette.middleware.cors import CORSMiddleware
import speech_recognition as sr
import io
from typing import Optional

# Initialize Firebase
cred = credentials.Certificate(r"C:\empathy\ai\empathyai-71e90-firebase-adminsdk-pgogz-63a8172c2e.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# Initialize FastAPI app
app = FastAPI()

# Add CORSMiddleware to the app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize ResponseGenerator
response_generator = ResponseGenerator()

# Define the message model
class Message(BaseModel):
    user_id: str
    text: str
    chat_id: str
    emotion: Optional[str] = None

class Feedback(BaseModel):
    message_id: str
    rating: int

@app.post("/chat")
async def chat(message: Message):
    try:
        # Log received message
        logger.info(f"Received message: {message.dict()}")

        # Generate response based on user input and emotion
        response = response_generator.generate_dynamic_response(message.emotion or "neutral", message.text, message.user_id)

        # Log generated response
        logger.info(f"Generated response: {response}")

        # Save to Firestore
        doc_ref = db.collection('chats').document(message.chat_id)
        doc_ref.set({
            'userId': message.user_id,
            'text': response,
            'sender': 'ai',
            'emotion': message.emotion,
            'timestamp': firestore.SERVER_TIMESTAMP
        })

        return {"response": response}

    except Exception as e:
        # Log error
        logger.error(f"Error in chat: {str(e)}")
        raise HTTPException(status_code=422, detail=str(e))

@app.post("/feedback")
async def receive_feedback(feedback: Feedback):
    try:
        # Store feedback in Firestore
        doc_ref = db.collection('feedback').document(feedback.message_id)
        doc_ref.set({
            'rating': feedback.rating,
            'timestamp': firestore.SERVER_TIMESTAMP
        })

        return {"message": "Feedback received"}
    except Exception as e:
        logger.error(f"Error receiving feedback: {str(e)}")
        raise HTTPException(status_code=422, detail="Error processing feedback")

@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        # Read audio file
        contents = await file.read()
        
        # Create audio file object
        audio = sr.AudioFile(io.BytesIO(contents))
        
        # Initialize recognizer
        r = sr.Recognizer()
        
        # Record audio data
        with audio as source:
            audio_data = r.record(source)
            
        # Perform speech recognition
        text = r.recognize_google(audio_data)
        
        # Log success
        logger.info(f"Successfully transcribed audio to: {text}")

        # Generate response from transcribed text
        response = response_generator.generate_dynamic_response("neutral", text)  # You can analyze the emotion here if needed
        
        return {"text": text, "response": response}
    except sr.UnknownValueError:
        logger.error("Speech recognition could not understand the audio")
        raise HTTPException(status_code=422, detail="Could not understand audio")
    except sr.RequestError as e:
        logger.error(f"Could not request results from speech recognition service: {str(e)}")
        raise HTTPException(status_code=422, detail="Speech recognition service error")
    except Exception as e:
        logger.error(f"Error transcribing audio: {str(e)}")
        raise HTTPException(status_code=422, detail="Error transcribing audio")

# Run the FastAPI app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)