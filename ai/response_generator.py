
import random
from typing import Dict, List, Optional
import datetime

class ResponseGenerator:
    def __init__(self):
        self.conversation_history: Dict[str, List[Dict]] = {}
        self.user_preferences: Dict = {}
        self.emotion_intensity_threshold = 0.7

    def analyze_emotion_intensity(self, text: str) -> float:
        # In a real implementation, this would use NLP to analyze the text
        # For now, we'll use a simple random value as a placeholder
        return random.random()

    def get_time_context(self) -> str:
        hour = datetime.datetime.now().hour
        if 5 <= hour < 12:
            return "morning"
        elif 12 <= hour < 18:
            return "afternoon"
        else:
            return "evening"

    def get_conversation_context(self, user_id: str) -> str:
        if user_id in self.conversation_history and len(self.conversation_history[user_id]) > 0:
            return self.conversation_history[user_id][-1].get('text', '')
        return ''

    def generate_coping_strategy(self, emotion: str) -> str:
        strategies = {
            "sadness": [
                "try taking a short walk in nature",
                "listen to uplifting music",
                "reach out to a friend for support"
            ],
            "anger": [
                "practice deep breathing exercises",
                "write down your thoughts in a journal",
                "engage in physical exercise to release tension"
            ],
            "fear": [
                "try a mindfulness meditation",
                "visualize a calm and safe place",
                "break down your concerns into smaller, manageable parts"
            ],
            "joy": [
                "share your happiness with others",
                "practice gratitude by noting what you're thankful for",
                "engage in an activity that brings you more joy"
            ],
            "surprise": [
                "take a moment to process your feelings",
                "consider the potential opportunities this surprise might bring",
                "share your experience with someone you trust"
            ]
        }
        return random.choice(strategies.get(emotion, [
            "take a few deep breaths",
            "reflect on your feelings",
            "consider talking to someone you trust"
        ]))

    def generate_follow_up_question(self, emotion: str, text: str) -> str:
        questions = {
            "sadness": [
                f"How long have you been feeling sad about {text}?",
                f"Is there something specific about {text} that's particularly upsetting?",
                "Have you experienced similar feelings of sadness before?"
            ],
            "joy": [
                f"What's the best part about {text} that's making you feel this way?",
                "How do you think you can maintain this positive feeling?",
                "Would you like to share this joy with someone special?"
            ],
            "anger": [
                f"What about {text} is frustrating you the most?",
                "Have you tried any strategies to manage your anger?",
                "Is there a way to address the source of your anger directly?"
            ],
            "fear": [
                f"What's the worst-case scenario you're imagining about {text}?",
                "Have you faced similar fears before? How did you handle them?",
                "What would help you feel more secure in this situation?"
            ],
            "surprise": [
                f"How has this surprise about {text} changed your perspective?",
                "Do you generally enjoy surprises, or do they make you uncomfortable?",
                "How do you think this surprise might affect your plans or decisions?"
            ]
        }
        return random.choice(questions.get(emotion, [
            "How are you feeling about this right now?",
            "Would you like to explore this feeling further?",
            "How do you think this might affect you going forward?"
        ]))

    def generate_dynamic_response(self, emotion: str, text: str, user_id: str) -> str:
        intensity = self.analyze_emotion_intensity(text)
        time_context = self.get_time_context()
        prev_context = self.get_conversation_context(user_id)
        
        # Emotion-specific base response
        emotion_specific_bases = {
            "sadness": f"I'm sorry to hear that you're feeling sad about '{text}'. ",
            "joy": f"It's amazing to hear that you're feeling joyful about '{text}'. ",
            "anger": f"I can understand why you're feeling angry about '{text}'. ",
            "fear": f"It's completely natural to feel fear about '{text}'. ",
            "surprise": f"It's intriguing to hear that you're feeling surprised about '{text}'. "
        }
        
        response = emotion_specific_bases.get(emotion, "")
        
        # Add time context
        response += f"As we talk this {time_context}, I want you to know that your feelings are valid. "
        
        # Add intensity-based response
        if intensity > self.emotion_intensity_threshold:
            response += f"I can sense that this is really important to you. "
        
        # Add emotion-specific response
        emotion_response = self.generate_emotion_specific_response(emotion, text)
        response += emotion_response
        
        # Add coping strategy
        strategy = self.generate_coping_strategy(emotion)
        response += f"One thing that might help is to {strategy}. "
        
        # Add follow-up question
        follow_up = self.generate_follow_up_question(emotion, text)
        response += follow_up
        
        # Add context from previous conversation if available
        if prev_context:
            response += f" Earlier, we talked about {prev_context}. How does this relate to your current feelings?"
        
        # Update conversation history
        if user_id not in self.conversation_history:
            self.conversation_history[user_id] = []
        self.conversation_history[user_id].append({
            'emotion': emotion,
            'text': text,
            'response': response,
            'timestamp': datetime.datetime.now()
        })
        
        return response

    def generate_emotion_specific_response(self, emotion: str, text: str) -> str:
        responses = {
            "sadness": [
                f"It's okay to feel sad about {text}. Sadness is a natural response to difficult situations. ",
                f"I'm here to listen and support you through this sadness regarding {text}. ",
                f"Feeling sad about {text} shows that you care deeply. It's a sign of your emotional depth. "
            ],
            "joy": [
                f"It's wonderful to hear that {text} is bringing you joy! These positive moments are worth cherishing. ",
                f"Your happiness about {text} is truly heartwarming. It's great to see you experiencing such positive emotions. ",
                f"The joy you're feeling about {text} is beautiful. It's moments like these that make life special. "
            ],
            "anger": [
                f"I can understand why {text} would make you feel angry. It's important to acknowledge these feelings. ",
                f"Your anger about {text} is valid. Sometimes, anger can be a signal that something needs to change. ",
                f"Feeling angry about {text} is a natural response. It's good that you're expressing this emotion. "
            ],
            "fear": [
                f"It's natural to feel fear when faced with {text}. Remember, you're stronger than you might think. ",
                f"I hear your concerns about {text}. Fear is our body's way of trying to keep us safe. ",
                f"Feeling fearful about {text} is understandable. Let's explore this feeling together. "
            ],
            "surprise": [
                f"Wow, {text} really caught you off guard! Surprises can sometimes shake up our world in unexpected ways. ",
                f"I can sense your surprise about {text}. Unexpected events can often lead to new insights or opportunities. ",
                f"It's interesting to hear about the surprise you experienced with {text}. How do you usually handle unexpected situations? "
            ]
        }
        return random.choice(responses.get(emotion, [
            f"I see that {text} is bringing up some strong emotions for you. ",
            f"Thank you for sharing your feelings about {text} with me. ",
            f"It's important to acknowledge and process these emotions about {text}. "
        ]))

    def add_user_preference(self, user_id: str, preference: Dict):
        self.user_preferences[user_id] = preference

# Usage example
if __name__ == "__main__":
    response_gen = ResponseGenerator()
    print(response_gen.generate_dynamic_response('sadness', 'losing my job', 'user1'))
    print("\n")
    print(response_gen.generate_dynamic_response('joy', 'getting a promotion', 'user1'))
