import json
import requests

# 定义 URL
tw_url = 'https://schaledb.com/data/tw/events.json'
kr_url = 'https://schaledb.com/data/kr/events.json'

# 获取 JSON 数据
tw_response = requests.get(tw_url)
kr_response = requests.get(kr_url)

# 确保请求成功
tw_response.raise_for_status()
kr_response.raise_for_status()

# 加载 JSON 数据
tw_data = tw_response.json()
kr_data = kr_response.json()

# 创建字典来存储事件名称映射
event_name_mapping = {}

# 遍历每个事件，根据 `Id` 匹配韩文和繁体中文的数据
for tw_event in tw_data.get("Stages", {}).values():
    tw_name = tw_event.get("Name")  # 获取繁体中文的名称
    event_id = tw_event.get("Id")  # 获取事件的 ID

    if event_id and tw_name:  # 确保 `Id` 和 `Name` 存在
        # 在韩文数据中找到对应的事件
        kr_event = kr_data.get("Stages", {}).get(str(event_id))
        if kr_event:
            kr_name = kr_event.get("Name")  # 获取韩文的名称
            if kr_name:  # 确保韩文名称存在
                event_name_mapping[kr_name] = tw_name

# 保存映射到 JSON 文件
output_file = 'stages_Event_mapping.json'
with open(output_file, 'w', encoding='utf-8') as outfile:
    json.dump(event_name_mapping, outfile, ensure_ascii=False, indent=4)

print(f"Event name mapping saved to {output_file}")
