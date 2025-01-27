import json
import requests

# 定义 URLs
jp_url = 'https://schaledb.com/data/jp/items.json'
kr_url = 'https://schaledb.com/data/kr/items.json'

# 获取数据
jp_response = requests.get(jp_url)
kr_response = requests.get(kr_url)

# 确保请求成功
jp_response.raise_for_status()
kr_response.raise_for_status()

# 加载 JSON 数据
jp_data = jp_response.json()
kr_data = kr_response.json()

# 创建字典存储韩文到繁体中文的描述映射
desc_mapping = {}

# 遍历韩文数据，使用相同的 ID 匹配繁体中文数据
for item_id, kr_item in kr_data.items():
    jp_item = jp_data.get(item_id)  # 获取繁体中文数据
    if jp_item:  # 如果繁体中文数据存在
        kr_desc = kr_item.get("Desc")  # 韩文描述
        jp_desc = jp_item.get("Desc")  # 繁体中文描述
        if kr_desc and jp_desc:  # 确保描述字段存在
            desc_mapping[kr_desc] = jp_desc

# 将结果保存到 JSON 文件
output_file = 'item_Desc_mapping.json'
with open(output_file, 'w', encoding='utf-8') as outfile:
    json.dump(desc_mapping, outfile, ensure_ascii=False, indent=4)

print(f"Description mapping saved to {output_file}")
# Description mapping saved to item_Desc_mapping.json