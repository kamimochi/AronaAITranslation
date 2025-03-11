import json
import requests

# 请求数据
tw_url = 'https://schaledb.com/data/tw/students.json'
kr_url = 'https://schaledb.com/data/kr/students.json'

tw_response = requests.get(tw_url)
kr_response = requests.get(kr_url)

# 确保请求成功
tw_response.raise_for_status()
kr_response.raise_for_status()

# 加载 JSON 数据
tw_students = tw_response.json()
kr_students = kr_response.json()

# 创建韩文到繁体中文的 Hobby 映射
Hobby_mapping = {}

# 遍历字典中的每个学生数据
for student_id in kr_students:
    kr_student = kr_students.get(student_id)  # 获取韩文学生数据
    tw_student = tw_students.get(student_id)  # 获取繁体中文学生数据
    
    if kr_student and tw_student:  # 确保两个字典中都存在这个学生
        kr_Hobby = kr_student.get("Hobby")
        tw_Hobby = tw_student.get("Hobby")
        if kr_Hobby and tw_Hobby:  # 确保 Hobby 字段存在且不为空
            Hobby_mapping[kr_Hobby] = tw_Hobby

# 保存结果到 JSON 文件
with open('Hobby_mapping.json', 'w', encoding='utf-8') as outfile:
    json.dump(Hobby_mapping, outfile, ensure_ascii=False, indent=4)

print("Hobby mapping saved to Hobby_mapping.json")
