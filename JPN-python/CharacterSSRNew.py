import json
import requests

# 请求数据
jp_url = 'https://schaledb.com/data/jp/students.json'
kr_url = 'https://schaledb.com/data/kr/students.json'

jp_response = requests.get(jp_url)
kr_response = requests.get(kr_url)

# 确保请求成功
jp_response.raise_for_status()
kr_response.raise_for_status()

# 加载 JSON 数据
jp_students = jp_response.json()
kr_students = kr_response.json()

# 创建韩文到繁体中文的映射
name_mapping = {}

# 遍历字典并匹配 CharacterSSRNew 字段
for student_id in kr_students:
    kr_student = kr_students.get(student_id)
    jp_student = jp_students.get(student_id)
    
    if kr_student and jp_student:
        kr_name = kr_student.get("CharacterSSRNew")
        jp_name = jp_student.get("CharacterSSRNew")
        if kr_name and jp_name:
            name_mapping[kr_name] = jp_name

# 保存结果到 JSON 文件
with open('CharacterSSRNew.json', 'w', encoding='utf-8') as outfile:
    json.dump(name_mapping, outfile, ensure_ascii=False, indent=4)

print("Name mapping saved to CharacterSSRNew.json")
