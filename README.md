# What is your intent?

This repository is the website for Intent, a programming language and the editor that comes with it: **[intent-lang.github.io](https://intent-lang.github.io/)**. Below is how it came about.

---

Imagine: It's vacation time, and after a few days the thoughts of work begin to fade. You spend time with family and friends, relax in a sun chair, and your mind wanders into ideas it rarely has time for. That used to happen to me every year, and I never got very far on my hobby project before it was time to go back to work.

## Where it started

Intent started over a decade ago. Around 2014 Rust was making waves with its borrow checker, and Jonathan Blow had started building Jai. Everyone seemed to have an opinion about programming languages and what was wrong with them.

One thing I agreed with Jonathan Blow on at the time was that programming should be rewarding and enjoyable. I saw programming as an art form, and as such it should be more like playing an instrument than typing on a typewriter.

But the Rust arguments didn't resonate with me. I thought our main problems were different. The bugs that were really hard to solve were usually about concurrency. Other big issues were around software architecture, where the encapsulation of object-oriented languages didn't really hit the right level.

Modularity was another thing that stayed with me. Ideas like OSGi had caught my attention back in my Java days, and I kept thinking about them long after I'd left that world behind.

I spent years seeing how complex and costly merging and integrating code is: taking other people's code and making sure it worked together across teams. I saw every flavor of merge conflict: sorting the includes causing mayhem, reordering methods making the auto-merge quietly move logic from one method into another.

No one was talking about changing the fundamentals: how code is *constructed*. We were still treating code as text. Git stores which lines changed. So I started wondering: what if we stored what the change meant, like *rename this variable* or *move this function*? What if we captured the *intent* of the programmer, not just the characters they typed?

During the 90s I was a Vim user. What I liked was having a mode where you *navigate and operate on* code, rather than simply typing into it. For some reason my first prototype of Intent was in the Atom editor, brand new in 2015. That feels like a lifetime ago, but editing code with Vim-like keys in Intent is the same now as it was then.

## Every vacation

Every vacation since, I started a blog post called "What is your intent?", and never finished a single one. Intent stayed a solo side project, and a few weeks a year wasn't enough to move it forward.

Over the years I kept learning. Sure, I took the compilers course at university, but that was 30 years ago. Since then I've read the Rust books, tinkered with the Zig compiler, studied LLVM and MLIR, and taken online courses, all to understand the world of programming languages a little better. I built one implementation after another, and started over each time normal life got in the way.

Slowly the project grew, and after the pandemic I finally had a basic version running on LLVM and MLIR.

New inspiration came along over the years, like Unity's Burst compiler, which takes scalar code and runs it on several values at once, in the SIMD lanes of the CPU. Intent's kernels follow the same idea.

## Then it changed

In 2025, AI became a real collaborator, a partner that can implement complex ideas from my descriptions. What had taken years of holiday hacking suddenly became possible.

With MLIR and LLVM as the foundation, AI let me move faster: build a more complete language, more sophisticated VS Code support, merging and diff tooling, and several agents developing in Intent at the same time. AI even helped me make the narrated introduction that you can play on **[intent-lang.github.io](https://intent-lang.github.io/)**.

Intent is where 30+ years of programming inspiration has led me. What started out as a way to give programmers an instrument ended up fitting the new agentic way of programming perfectly. Today several agents and I write code in the same Intent project. In my own programming language.

## Where it is now

This repo is a little tease of what Intent is or could be. The introduction runs about 5 minutes, and there are short descriptions of the four central themes:

- [Vim-inspired authoring, without a text editor](https://intent-lang.github.io/authoring.html)
- [Modules, lifetime management and hot reload](https://intent-lang.github.io/modules.html)
- [Concurrency: tasks, jobs and kernels](https://intent-lang.github.io/concurrency.html)
- [Merging and multi-agent contributions](https://intent-lang.github.io/merging.html)

Intent is still in development, and its source isn't public yet.

— Petter Edblom
