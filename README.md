# NeuroStrike
NeuroStrike

Mini game to help train mental math!

Video Demo: 
Description:
NeuroStrike is a web-based memory and mental math game designed to test a players focus, tracking ability, and calculation skills under pressure. The project is built using HTML5, CSS3, Vanilla JavaScript, and Google Firebase for backend database and authentication services.

The initial idea for this project started when I wanted to experiment with web graphics. My very first test of concept was actually just the number floating background, I wanted to see if I could make an HTML5 Canvas render random numbers floating across the screen that react and light up when your mouse hovers near them. Once I got that working it gave me the idea to turn it into a full playable game where you actually have to track the numbers instead of just looking at them.

Development Process and Architecture
When I actually started building the logic I looked back at the earlier CS50 problem sets to figure out how to structure it. I built a local version of the game first using Flask and python, using the same setup we learned in the course. This local version was really helpful for testing the basic gameplay loops which was mostly done using Object Oriented Programming in JavaScript for the frontend. I created a PlayNumber class so that every number spawned on the screen has its own velocity, color, size, and value.

But because I wanted my friends to easily play it without downloading a whole python server and running it locally I decided to move it fully online. I ditched the Flask backend and moved the whole database over to Google Firebase because it works really good for web apps and doesn't require a traditional server so I can just host it on GitHub Pages. I set up Firebase Authentication to support both anonymous accounts (so players can play instantly) and Google Sign-In for persistent accounts. The scores and player progress are saved using Cloud Firestore.

The most complex part of the game logic was managing the difficulty scaling. For example the Impossible mode has negative numbers, multiple colors to track separately, and numbers that change color when they cross the center of the screen, and it gets really chaotic when there are fake decoy numbers flying around too.

One major design decision was how to handle custom profile pictures for user accounts. Instead of using a separate Firebase Cloud Storage bucket which costs more and requires complex setups, I built a feature that uses a invisible HTML canvas. When a user uploads an image, the canvas crops it into a perfect 80x80 square, compresses it, and converts it directly into a Base64 text string. This means the image can just be saved directly as text into the Firestore database which saves alot of space and makes loading the leaderboard extremely fast.

Features
Progressive Difficulties: Easy, Medium, Hard, Extreme, and Impossible modes that gradually introduce multiple colors to track, decoys, and negative values.

Custom Level Editor: A sandbox mode where players can use sliders to adjust the speed, digit count, color rules, and active modifiers to generate a custom score multiplier.

Global Leaderboards: Real-time top 10 tracking using Firebase Firestore.

Profile System: Custom display names (with duplicate name validation) and a built-in image cropper for profile pictures.

Calculator Widget: A built in calculator that players can toggle if the math gets way to hard, though using it applies an 80% penalty to the final score.

Files Overview
index.html: Contains the structural framework and UI containers of the game like the main menu, answer screen, account settings, and tutorial popups.

style.css: Contains all the styling, layout rules, and the neon aesthetic. It uses flexbox for centering and custom borders to give the UI a glowing, futuristic arcade feel.

game.js: The main brain of the application. It handles the requestAnimationFrame loop, canvas rendering, user input, math validation, and all the backend Firebase API calls for authentication and database read/writes.
