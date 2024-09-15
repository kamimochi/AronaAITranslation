import json
import requests

tw_url = 'https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/tw/students.json'
kr_url = 'https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/kr/students.json'

tw_response = requests.get(tw_url)
kr_response = requests.get(kr_url)

# Ensure the requests were successful
tw_response.raise_for_status()
kr_response.raise_for_status()

# Load the JSON data from the responses
tw_students = tw_response.json()
kr_students = kr_response.json()

# Create a dictionary to store the Korean to Traditional Chinese mapping
Hobby_mapping = {}

# Iterate through both JSON files and map the PersonalHobby fields
for kr_student, tw_student in zip(kr_students, tw_students):
    kr_Hobby = kr_student.get("Hobby")
    tw_Hobby = tw_student.get("Hobby")
    if kr_Hobby and tw_Hobby:
        Hobby_mapping[kr_Hobby] = tw_Hobby

# Save the result to a new JSON file
with open('Hobby_mapping.json', 'w', encoding='utf-8') as outfile:
    json.dump(Hobby_mapping, outfile, ensure_ascii=False, indent=4)

print("Hobby mapping saved to Hobby_mapping.json")