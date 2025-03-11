@echo off

:: 切換到 start.bat 所在的資料夾 (即 python 資料夾)
cd /d "%~dp0"

:: 執行所有 Python 腳本
py CharacterSSRNew.py
py equipment.py
py equipmentDesc.py
py furniture.py
py furnitureDesc.py
py locjsonArmorType.py
py locjsonBulletType.py
py locjsonclub.py
py locjsonevent.py
py locjsonFamilyName.py
py locjsonHobby.py
py locjsonitem.py
py locjsonitemDesc.py
py locjsonschool.py
py locjsonskill.py
py locjsonstu.py
py locjsonTacticRole.py
py stages.py
py Event.py
py ProfileIntroductionStu.py
py WeaponName.py
py crafting.py

:: 如果沒有上層的 json 資料夾，就自動建立一個
if not exist "..\zh_TW-json" (
    mkdir "..\zh_TW-json"
)

:: 將所有 .json 檔案複製到上層的 json 資料夾 (/y 代表自動覆蓋)
xcopy /y *.json ..\zh_TW-json\

del *.json
echo All Python scripts have been executed.
pause