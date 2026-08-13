import re
with open('src/pages/dashboard/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r"\s+isCustom:\s+true,?\s+customValue:\s+['\"][^'\"]*['\"],?", "", content)
content = re.sub(r"} else if \(s\.isCustom\) \{\s+finalValue = s\.customValue as string \| number;\s+}", "", content)

with open('src/pages/dashboard/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
