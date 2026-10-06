from flask import Flask, render_template

app = Flask(__name__)
# This prevents the browser from caching old CSS/JS files while testing
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

@app.route("/")
def index():
    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True, port=5000)
