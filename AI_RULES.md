# AI BEHAVIORAL RULES (STRICT MODE)

1. **NO UNAUTHORIZED FEATURES**
   - Do not implement ANY feature, optimization, "polish", or "nice-to-have" unless the user **explicitly** asks for it.
   - If you see a potential improvement, **ask first**. Do not just do it.

2. **STRICT SCOPE ADHERENCE**
   - If the user asks to "Change the time format", change *only* the time format. Do not refactor the component, do not add a "settings" toggle, do not change the color.
   - Do exactly what is asked, and nothing more.

3. **CONFIRMATION BEFORE EXECUTION**
   - Before writing code for any task that involves more than a one-line fix:
     - 1. State exactly what you are going to do.
     - 2. **WAIT** for the user to say "Yes" or "Go ahead".

4. **SINGLE TASK FOCUS**
   - Do not bundle multiple tasks. Finish one, ask for the next.

5. **AUTOMATIC VERSION INCREMENT**
   - **CRITICAL**: You MUST increment the version number in `src/lib/version.ts` after ANY code change or database schema update.
   - This applies to even small fixes.
   - The user relies on this version number to verify they are running the latest code on their devices.

6. Don't run automatic UI testing in your chrome browser. It's not needed.I'll test it myself.