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

# 创建韩文到繁体中文的 FamilyName 映射
FamilyName_mapping = {}

# 遍历字典中的每个学生数据
for student_id in kr_students:
    kr_student = kr_students.get(student_id)  # 获取韩文学生数据
    jp_student = jp_students.get(student_id)  # 获取繁体中文学生数据
    
    if kr_student and jp_student:  # 确保两个字典中都存在这个学生
        kr_FamilyName = kr_student.get("FamilyName")
        jp_FamilyName = jp_student.get("FamilyName")
        if kr_FamilyName and jp_FamilyName:  # 确保 FamilyName 字段存在且不为空
            FamilyName_mapping[kr_FamilyName] = jp_FamilyName

# 保存结果到 JSON 文件
with open('FamilyName_mapping.json', 'w', encoding='utf-8') as outfile:
    json.dump(FamilyName_mapping, outfile, ensure_ascii=False, indent=4)

print("FamilyName mapping saved to FamilyName_mapping.json")
