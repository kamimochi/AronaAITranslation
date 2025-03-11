import json
import requests


tw_url = 'https://schaledb.com/data/tw/students.json'
kr_url = 'https://schaledb.com/data/kr/students.json'

tw_response = requests.get(tw_url)
kr_response = requests.get(kr_url)


tw_response.raise_for_status()
kr_response.raise_for_status()


tw_students = tw_response.json()
kr_students = kr_response.json()


name_mapping = {}


for student_id in kr_students:
    kr_student = kr_students.get(student_id)  
    tw_student = tw_students.get(student_id)  

    if kr_student and tw_student:  
        kr_name = kr_student.get("Name")
        tw_name = tw_student.get("Name")

        if kr_name and tw_name:  
            name_mapping[kr_name] = tw_name

with open('students_mapping.json', 'w', encoding='utf-8') as outfile:
    json.dump(name_mapping, outfile, ensure_ascii=False, indent=4)

print("Name mapping saved to students_mapping.json")
