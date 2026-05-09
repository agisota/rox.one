import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";

function Home(): React.ReactElement {
  return (
    <main>
      <h1>Home</h1>
      <nav>
        <Link to="/">Home</Link> | <Link to="/about">About</Link> | <Link to="/contact">Contact</Link>
      </nav>
    </main>
  );
}

function About(): React.ReactElement {
  return (
    <main>
      <h1>About</h1>
      <nav>
        <Link to="/">Home</Link> | <Link to="/about">About</Link> | <Link to="/contact">Contact</Link>
      </nav>
    </main>
  );
}

function Contact(): React.ReactElement {
  return (
    <main>
      <h1>Contact</h1>
      <nav>
        <Link to="/">Home</Link> | <Link to="/about">About</Link> | <Link to="/contact">Contact</Link>
      </nav>
    </main>
  );
}

function App(): React.ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
    </BrowserRouter>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
