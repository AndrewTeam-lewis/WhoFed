import sys

file_path = '/Users/Andrew/Code/WhoFed/src/routes/pets/add/+page.svelte'
with open(file_path, 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if i >= 696 and i <= 717:
        continue
    new_lines.append(line)

new_content = """                                     <div class="flex items-center space-x-3 bg-neutral-surface rounded-2xl px-4 py-3 group focus-within:ring-2 focus-within:ring-brand-sage/50 transition-all border border-transparent hover:border-brand-sage/20">
                                         <!-- Time Input (Left) -->
                                         <div class="relative flex-1">
                                             <input 
                                                type="time" 
                                                bind:value={schedule.times[i].value}
                                                class="w-full bg-white rounded-lg px-3 py-1.5 border border-gray-100 text-typography-primary font-bold focus:ring-2 focus:ring-brand-sage/20 p-0 text-base text-center shadow-sm cursor-pointer accent-brand-sage"
                                            />
                                         </div>
"""
new_lines.insert(696, new_content)

with open(file_path, 'w') as f:
    f.writelines(new_lines)
print("File patched")
