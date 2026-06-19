# I gameified something so I didn't have to read the documentation.

As is the best way to learn. Runs on Git Pages.

---

## Why I built this

I read for my job, I didn't want to dig through documentation, I'm chronically on my phone, and I have a Claude subscription.

Chapters are graded by difficulty (obviously). Internal chapter markers show you each command. Navigation needs some work but it's 
passable. Commands are entered into a mockup terminal.

## Chapters

**Essentials**
1. **Starting a repo** — `init`, `clone`, `status`
2. **First commits** — `add`, `commit`
3. **Looking around** — `log`, `diff`, `diff --staged`
4. **Branches & switching** — `branch`, `switch`/`checkout`, `switch -`, `-d`/`-D`
5. **Merging** — fast-forward vs. merge commits, `--no-ff`
6. **Merge conflicts** — trigger, resolve, `merge --abort`
7. **The undo button** — `restore`, `reset --soft/--mixed/--hard`, `commit --amend`
8. **Ignoring files** — `.gitignore`, `rm --cached`
9. **Going online** — `remote`, `push -u`, `pull`, `pull --rebase`, `fetch`
10. **Fork & contribute** — two remotes, branch → pull request, syncing `upstream`

**Advanced**
11. **Stash** — `stash`, `pop`, `apply`, `list`
12. **Rebase & squash** — `rebase`, `rebase -i`
13. **Cherry-pick**
14. **Force push without crying** — `--force`/`-f` vs. `--force-with-lease`
15. **Safe undo & recovery** — `revert`, `reflog`
16. **Tags & releases** — `tag`, `tag -a`, `push --tags`


## Run it online

Go to the [Git Pages](https://thomas-toh.github.io/github-for-dummies/) page. That's it :~)

## Or... if you so desire... I guess you could run it locally

I recommend you just run it off Git Pages, but if you so desire, you can download it and just open index.html.

Or you can use the following command in the folder once downloaded:

```sh
open index.html        # macOS — or double-click it, or drag it into any browser
```

(Frankly, if you knew how to do that, what's the chance you'd need this anyway?)

## To dos

- Clean up the ugly navigation.
- Daily challenges (?)
- App (??)
- The same thing but for a different topic altogether?

## License

[MIT](LICENSE), of course.

---

<sub>Built with [Claude Code](https://claude.com/claude-code). Thanks Claude, you make me the coder I'm not.</sub>
