@echo off


:: 切换到脚本所在的目录
cd /d "%~dp0"

:: 执行所有 Python 脚本
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
echo All Python scripts have been executed.
pause
