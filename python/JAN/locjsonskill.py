import json
import requests

jp_url = 'https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/jp/students.json'
kr_url = 'https://raw.githubusercontent.com/SchaleDB/SchaleDB/main/data/kr/students.json'

jp_response = requests.get(jp_url)
kr_response = requests.get(kr_url)

# Ensure the requests were successful
kr_response.raise_for_status()
jp_response.raise_for_status()

# Load the JSON data from the response
kr_data = kr_response.json()
jp_data = jp_response.json()

# Create a dictionary to store the skill name mappings
skill_name_mapping = {}

# Use a set to store already processed skill names to avoid duplication
processed_skills = set()

# Iterate over all students in both files to map skills
skill_name_mapping = {}

# Iterate over all students in both files to map skills
for kr_student, jp_student in zip(kr_data, jp_data):
    kr_skills = kr_student.get('Skills', [])
    jp_skills = jp_student.get('Skills', [])

    for kr_skill, jp_skill in zip(kr_skills, jp_skills):
        kr_skill_name = kr_skill.get('Name')
        jp_skill_name = jp_skill.get('Name')

        # Check if the skill names are not None
        if kr_skill_name and jp_skill_name:
            skill_name_mapping[kr_skill_name] = jp_skill_name

# Save the result to a new JSON file
with open('skill_name_mapping.json', 'w', encoding='utf-8') as outfile:
    json.dump(skill_name_mapping, outfile, ensure_ascii=False, indent=4)

print("Skill name mappings saved to skill_name_mapping.json")