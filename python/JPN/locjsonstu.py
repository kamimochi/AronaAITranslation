import json
import requests

# 请求数据的 URL
jp_url = 'https://schaledb.com/data/jp/students.json'
kr_url = 'https://schaledb.com/data/kr/students.json'

# 发起请求
jp_response = requests.get(jp_url)
kr_response = requests.get(kr_url)

# 确保请求成功
jp_response.raise_for_status()
kr_response.raise_for_status()

# 加载 JSON 数据
jp_students = jp_response.json()
kr_students = kr_response.json()

# 创建字典来存储韩文到繁体中文的名称映射
name_mapping = {}

# 遍历两个字典，通过学生 ID 匹配数据
for student_id in kr_students:
    kr_student = kr_students.get(student_id)  # 获取韩文学生数据
    jp_student = jp_students.get(student_id)  # 获取繁体中文学生数据

    if kr_student and jp_student:  # 确保两个字典中都有这个学生
        kr_name = kr_student.get("Name")
        jp_name = jp_student.get("Name")

        if kr_name and jp_name:  # 确保 Name 字段存在且不为空
            name_mapping[kr_name] = jp_name

# 保存结果到 JSON 文件
with open('students_mapping.json', 'w', encoding='utf-8') as outfile:
    json.dump(name_mapping, outfile, ensure_ascii=False, indent=4)

print("Name mapping saved to students_mapping.json")
