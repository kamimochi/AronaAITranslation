import json
import requests

jp_url = 'https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/jp/students.json'
kr_url = 'https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/kr/students.json'

jp_response = requests.get(jp_url)
kr_response = requests.get(kr_url)

# Ensure the requests were successful
jp_response.raise_for_status()
kr_response.raise_for_status()

# Load the JSON data from the responses
jp_students = jp_response.json()
kr_students = kr_response.json()

# Create a dictionary to store the Korean to Traditional Chinese mapping
FamilyName_mapping = {}

# Iterate through both JSON files and map the PersonalFamilyName fields
for kr_student, jp_student in zip(kr_students, jp_students):
    kr_FamilyName = kr_student.get("FamilyName")
    jp_FamilyName = jp_student.get("FamilyName")
    if kr_FamilyName and jp_FamilyName:
        FamilyName_mapping[kr_FamilyName] = jp_FamilyName

# Save the result to a new JSON file
with open('FamilyName_mapping.json', 'w', encoding='utf-8') as outfile:
    json.dump(FamilyName_mapping, outfile, ensure_ascii=False, indent=4)

print("FamilyName mapping saved to FamilyName_mapping.json")