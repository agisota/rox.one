import React from "react";
import { createRoot } from "react-dom/client";

function Home(): React.ReactElement {
  return (
    <main>
      <h1>Home</h1>
      <nav>
        <a href="/">Home</a> | <a href="/about">About</a> | <a href="/contact">Contact</a>
      </nav>
    </main>
  );
}

function About(): React.ReactElement {
  return (
    <main>
      <h1>About</h1>
      <nav>
        <a href="/">Home</a> | <a href="/about">About</a> | <a href="/contact">Contact</a>
      </nav>
    </main>
  );
}

function Contact(): React.ReactElement {
  return (
    <main>
      <h1>Contact</h1>
      <nav>
        <a href="/">Home</a> | <a href="/about">About</a> | <a href="/contact">Contact</a>
      </nav>
    </main>
  );
}

function App(): React.ReactElement {
  const path = window.location.pathname;
  if (path === "/about") return <About />;
  if (path === "/contact") return <Contact />;
  return <Home />;
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
