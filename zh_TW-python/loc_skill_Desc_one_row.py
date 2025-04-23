import requests
import json
import re
import collections
import itertools

# 1. 先抓 TW students.json 並取出所有 Ex 技能名
tw_url = 'https://schaledb.com/data/tw/students.json'
tw_data = requests.get(tw_url).json()
ex_names = {
    info['Skills']['Ex']['Name']
    for info in tw_data.values()
    if info.get('Skills', {}).get('Ex', {}).get('Name')
}

# 2. 再抓 LocalizeSkillExcelTable.json
url = "https://raw.githubusercontent.com/electricgoat/ba-data/refs/heads/global/DB/LocalizeSkillExcelTable.json"
data = requests.get(url).json()

# 3. 清洗文字的函式：去掉 [xxx] 標籤、換行、處理斜線後空白
tag_pattern = re.compile(r'\[.*?\]|\n')
def clean_text(text: str) -> str:
    text = tag_pattern.sub('', text)
    text = re.sub(r'/([^ \s])', r'/ \1', text)
    return re.sub(r'\s+', ' ', text).strip()

# 4. 建立 mapping，只取每個 EX 技能前 5 筆，其它技能全取
def build_mapping(data, ex_names):
    mapping = collections.OrderedDict()
    counters = collections.defaultdict(int)
    for item in data['DataList']:
        kr = item.get('DescriptionKr')
        tw = item.get('DescriptionTw')
        name_tw = item.get('NameTw')
        if not kr or not tw:
            continue
        kr_c = clean_text(kr)
        tw_c = clean_text(tw)
        if name_tw in ex_names:
            if counters[name_tw] < 5:
                mapping[kr_c] = tw_c
                counters[name_tw] += 1
        else:
            mapping[kr_c] = tw_c
    return mapping

mapping = build_mapping(data, ex_names)

def extract_numbers_and_mask(text):
    """
    Extracts numbers (int, float, percentage) from text and returns a masked version
    with placeholders and the list of extracted numbers.
    """
    # Regex to find numbers (integers, floats, optional trailing %)
    # Ensure it captures the % sign along with the number
    numbers = re.findall(r'(\d+(?:\.\d+)?%?)', text)
    # Replace numbers with a placeholder '{num}'
    masked_text = re.sub(r'(\d+(?:\.\d+)?%?)', '{num}', text)
    return masked_text, numbers

def merge_number_sequences(sequences):
    """
    Merges multiple lists of numbers.
    Example: [['10', '20'], ['15', '20']] -> ['10/15', '20']
    """
    if not sequences:
        return []

    num_positions = len(sequences[0])
    merged_numbers = []

    for i in range(num_positions):
        nums_at_pos = [seq[i] for seq in sequences]
        # Check if all numbers at this position are the same
        if len(set(nums_at_pos)) == 1:
            merged_numbers.append(nums_at_pos[0])
        else:
            merged_numbers.append('/'.join(nums_at_pos))
    return merged_numbers

def replace_placeholders(masked_text, numbers):
    """
    Replaces '{num}' placeholders in the masked text with the provided numbers sequentially.
    """
    parts = masked_text.split('{num}')
    result = ""
    for i, part in enumerate(parts):
        result += part
        if i < len(numbers):
            result += numbers[i]
    return result

output_filename = 'skill_Desc_one_row.json'

try:
    # Load the JSON data, preserving order using OrderedDict
    # Note: In Python 3.7+, standard dict preserves insertion order,
    # but using OrderedDict is safer for compatibility.
    

    processed_mapping = collections.OrderedDict()
    items = list(mapping.items())
    if not items:
        print("輸入的 JSON 文件是空的。")
    else:
        i = 0
        while i < len(items):
            current_key, current_value = items[i]
            current_masked_key, current_key_nums = extract_numbers_and_mask(current_key)
            current_masked_value, current_value_nums = extract_numbers_and_mask(current_value)

            # Start a potential group with the current item
            current_group = [(current_key, current_value, current_key_nums, current_value_nums)]
            j = i + 1

            # Look ahead for mergeable items
            while j < len(items):
                next_key, next_value = items[j]
                next_masked_key, next_key_nums = extract_numbers_and_mask(next_key)
                next_masked_value, next_value_nums = extract_numbers_and_mask(next_value)

                # Check if structures and number counts match
                if (current_masked_key == next_masked_key and
                    current_masked_value == next_masked_value and
                    len(current_key_nums) == len(next_key_nums) and
                    len(current_value_nums) == len(next_value_nums)):
                    # Add to the group
                    current_group.append((next_key, next_value, next_key_nums, next_value_nums))
                    j += 1
                else:
                    # Structure mismatch, stop grouping
                    break

            # Process the found group
            if len(current_group) > 1:
                # Merge the items in the group
                all_key_nums = [item[2] for item in current_group]
                all_value_nums = [item[3] for item in current_group]

                merged_key_nums = merge_number_sequences(all_key_nums)
                merged_value_nums = merge_number_sequences(all_value_nums)

                # Use the masked text from the first item and the merged numbers
                # Need the original masked templates (before potential issues)
                base_masked_key, _ = extract_numbers_and_mask(current_group[0][0])
                base_masked_value, _ = extract_numbers_and_mask(current_group[0][1])


                merged_key = replace_placeholders(base_masked_key, merged_key_nums)
                merged_value = replace_placeholders(base_masked_value, merged_value_nums)

                processed_mapping[merged_key] = merged_value
                i = j # Move index past the merged group
            else:
                # No merge occurred, add the single item
                processed_mapping[current_key] = current_value
                i += 1

    # Save the processed data to a new JSON file
    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(processed_mapping, f, ensure_ascii=False, indent=4)

    print(f"處理完成，結果已儲存至 {output_filename}")
except Exception as e:
    print(f"處理時發生錯誤: {e}")
