<!-- QUICK CUSTOMIZATION GUIDE -->

<!-- 1. index.html - Update the hero section -->
Replace these placeholders:
- "Kyle Hunady" → Your name
- "Graduate Student | Researcher | Developer" → Your tagline
- "your.email@example.com" → Your email
- GitHub and LinkedIn URLs → Your profiles

<!-- 2. about.html - Add your details -->
- [your field of study] → e.g., "Computer Science"
- [your research area/interests] → e.g., "Machine Learning and NLP"
- [your goals/values] → Your professional goals
- [University Name] → Your school name
- [Your Program] → e.g., "Master's in Computer Science"
- [Your Major] → e.g., "Information Technology"
- [your hobbies/interests] → Personal interests

- Update skills by editing the .skill-tag elements
  Common skills to include:
  - Research, Data Analysis, Python, JavaScript
  - Machine Learning, Statistics, Web Development
  - Problem Solving, Communication, Leadership

<!-- 3. projects.html - Add your work -->
Update each .project-card with:
- Project Title
- Year and category
- Description of what you built and why
- Technologies used (update the .tag elements)
- Link to the project (update href in .project-link)

Add your publications:
- Paper title, author list, journal/conference, year
- Link to the paper PDF or publication page

<!-- 4. assets/css/style.css - Customize appearance -->
Color scheme - Update :root variables:
- --primary-color: Main color (currently dark blue)
- --secondary-color: Accent (currently light blue)
- --accent-color: Call-to-action (currently red)

Font - The site uses Segoe UI by default
Change in body { font-family: ... }

<!-- 5. Deploy -->
1. Commit your changes:
   git add .
   git commit -m "Initial portfolio site"
   git push

2. Enable GitHub Pages:
   - Go to your repo settings
   - Scroll to "Pages"
   - Select main branch as source
   - Your site will be live in a few minutes

3. Check your site at: https://kylehunady.github.io
