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
name_mapping = {}

# Iterate through both JSON files and map the PersonalName fields
for kr_student, tw_student in zip(kr_students, tw_students):
    kr_name = kr_student.get("Name")
    tw_name = tw_student.get("Name")
    if kr_name and tw_name:
        name_mapping[kr_name] = tw_name

# Save the result to a new JSON file
with open('students_mapping.json', 'w', encoding='utf-8') as outfile:
    json.dump(name_mapping, outfile, ensure_ascii=False, indent=4)

print("Name mapping saved to name_mapping.json")