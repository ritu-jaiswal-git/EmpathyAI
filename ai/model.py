


from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

class EmotionClassifier:
    def __init__(self):
        self.tokenizer = AutoTokenizer.from_pretrained(r"C:\empathy\ai\fine_tuned_model")
        self.model = AutoModelForSequenceClassification.from_pretrained(r"C:\empathy\ai\fine_tuned_model")

    def classify(self, text):
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, padding=True)
        outputs = self.model(**inputs)
        probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
        return probs.tolist()[0]

emotion_classifier = EmotionClassifier()


