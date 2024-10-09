import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { marked } from 'marked'

const readFile = (filename) => {
    const rawFile = fs.readFileSync(filename, 'utf8')
    const parsed = matter(rawFile)
    const html = marked(parsed.content)
    console.log(html)
}

readFile(path.join(path.resolve(), 'src/241009 마크다운 문법 소개.md') )
