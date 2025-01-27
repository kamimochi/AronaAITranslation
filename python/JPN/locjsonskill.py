import json
import requests

# 请求数据
jp_url = 'https://schaledb.com/data/jp/students.json'
kr_url = 'https://schaledb.com/data/kr/students.json'

jp_response = requests.get(jp_url)
kr_response = requests.get(kr_url)

# 确保请求成功
kr_response.raise_for_status()
jp_response.raise_for_status()

# 加载 JSON 数据
kr_data = kr_response.json()
jp_data = jp_response.json()

# 创建一个字典来存储技能名称映射
skill_name_mapping = {}

# 遍历两份数据以映射技能名称
for student_id in kr_data:
    kr_student = kr_data.get(student_id)
    jp_student = jp_data.get(student_id)

    # 确保两边都有学生数据
    if not kr_student or not jp_student:
        continue

    # 获取技能信息
    kr_skills = kr_student.get('Skills', {})
    jp_skills = jp_student.get('Skills', {})

    # 遍历技能信息
    for skill_type in kr_skills:
        kr_skill = kr_skills.get(skill_type, {})
        jp_skill = jp_skills.get(skill_type, {})

        kr_skill_name = kr_skill.get('Name')
        jp_skill_name = jp_skill.get('Name')

        # 确保技能名称存在
        if kr_skill_name and jp_skill_name:
            skill_name_mapping[kr_skill_name] = jp_skill_name

# 将结果保存到 JSON 文件
with open('skill_name_mapping.json', 'w', encoding='utf-8') as outfile:
    json.dump(skill_name_mapping, outfile, ensure_ascii=False, indent=4)

print("Skill name mappings saved to skill_name_mapping.json")
