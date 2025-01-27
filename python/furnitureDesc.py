import json
import requests

# 定义 URLs
tw_url = 'https://schaledb.com/data/tw/furniture.json'
kr_url = 'https://schaledb.com/data/kr/furniture.json'

# 获取数据
tw_response = requests.get(tw_url)
kr_response = requests.get(kr_url)

# 确保请求成功
tw_response.raise_for_status()
kr_response.raise_for_status()

# 加载 JSON 数据
tw_data = tw_response.json()
kr_data = kr_response.json()

# 创建字典存储韩文到繁体中文的描述映射
desc_mapping = {}

# 遍历韩文数据，通过相同的 ID 匹配繁体中文数据
for item_id, kr_item in kr_data.items():
    tw_item = tw_data.get(item_id)  # 获取繁体中文数据
    if tw_item:  # 如果繁体中文数据存在
        kr_desc = kr_item.get("Desc")  # 韩文描述
        tw_desc = tw_item.get("Desc")  # 繁体中文描述
        if kr_desc and tw_desc:  # 确保描述字段存在
            desc_mapping[kr_desc] = tw_desc

# 将结果保存到 JSON 文件
output_file = 'furniture_Desc_mapping.json'
with open(output_file, 'w', encoding='utf-8') as outfile:
    json.dump(desc_mapping, outfile, ensure_ascii=False, indent=4)

print(f"Description mapping saved to {output_file}")
