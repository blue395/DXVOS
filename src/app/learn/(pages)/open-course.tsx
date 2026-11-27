"use client";

// The course at /learn is a whole page of its own (DXV's single-file course), so it's always
// opened with a full page load, never the app's in-page navigation.
import { useEffect } from "react";
import { learnLink } from "./card";

export function OpenCourse() {
  useEffect(() => window.location.replace("/learn"), []);
  return (
    <p>
      Opening the course. If nothing happens,{" "}
      <a href="/learn" className={learnLink}>
        go to the course
      </a>
      .
    </p>
  );
}
