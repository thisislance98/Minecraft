import re

with open('src/game/systems/UIManager.js', 'r') as f:
    content = f.read()

# Fix CSS properties like "border - radius" -> "border-radius"
content = re.sub(r'([a-zA-Z]+) - ([a-zA-Z]+):', r'\1-\2:', content)
content = re.sub(r'([a-zA-Z]+) - ([a-zA-Z]+) - ([a-zA-Z]+):', r'\1-\2-\3:', content)

# Fix HTML tags like "< div" -> "<div" and "</div >" -> "</div>"
content = re.sub(r'< ([a-z0-9]+)', r'<\1', content)
content = re.sub(r'<\/ ([a-z0-9]+) >', r'</\1>', content)
content = re.sub(r' \/ >', r' />', content) # for self-closing tags if any

# Fix percentages like "50 %" -> "50%"
content = re.sub(r'([0-9]+) %', r'\1%', content)

# Specific fix for line 930 if missed
content = content.replace('< div class="message-content" >', '<div class="message-content">')
content = content.replace('</div >', '</div>')

# Specific fix for line 1083 if missing backtick
# 1083: ${ pos.x.toFixed(1) }, ${ pos.y.toFixed(1) }, ${ pos.z.toFixed(1) } `;
# Looking at the prev output, it might be missing the backtick.
# Let's see if we can identify it.
content = re.sub(r'textContent =\s*\$\{ pos\.x\.toFixed\(1\)', 'textContent = `${ pos.x.toFixed(1)}', content)

with open('src/game/systems/UIManager.js', 'w') as f:
    f.write(content)
