import pandas as pd
from sklearn.model_selection import train_test_split

# Load your emotion dataset
df = pd.read_csv(r'C:\empathy\ai\data\test.csv')


# Split the data into train and validation sets
train_df, val_df = train_test_split(df, test_size=0.2, random_state=42)

# Save the split datasets
train_df.to_csv('ai/data/train.csv', index=False)
val_df.to_csv('ai/data/val.csv', index=False)

print("Data preparation complete. Check ai/data/ for train.csv and val.csv")