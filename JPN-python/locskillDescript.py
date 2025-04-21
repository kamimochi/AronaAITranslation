import requests
import json
import re

url = "https://raw.githubusercontent.com/electricgoat/ba-data/refs/heads/jp/DB/LocalizeSkillExcelTable.json"
response = requests.get(url)
data = response.json()

def clean_text(text: str) -> str:
    # 移除所有 [xxx] 標籤
    text = re.sub(r'\[.*?\]', '', text)
    # 去除換行
    text = text.replace('\n', '')
    # 如果 / 後面緊接文字，就插入空白
    text = re.sub(r'/([^ \s])', r'/ \1', text)
    # 收斂多重空格並去除首尾空白
    return re.sub(r'\s+', ' ', text).strip()

def build_mapping(data: dict) -> dict:
    mapping = {}
    for item in data.get("DataList", []):
        kr = item.get("DescriptionKr", "")
        Jp = item.get("DescriptionJp", "")
        if kr and Jp:
            kr_clean = clean_text(kr)
            jp_clean = clean_text(Jp)
            mapping[kr_clean] = jp_clean
    return mapping

output_file = "skill_Desc_mapping.json"
with open(output_file, 'w', encoding='utf-8') as outfile:
    json.dump(build_mapping(data), outfile, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    mapping = build_mapping(data)
    print(f"Mapping saved to {output_file}")
    

