import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { marked } from 'marked'

const readFile = (filename) => {
    const rawFile = fs.readFileSync(filename, 'utf8')
    const parsed = matter(rawFile)
    const html = marked(parsed.content)
    
    return { ...parsed, html }
}

const templatize = (template, { title, date, content }) =>
    template
        .replace(/{{ content }}/g, content)
        .replace(/{{ title }}/g, title)
        .replace(/{{ date }}/g, date)


const template = fs.readFileSync(path.join(path.resolve(), 'src/template.html'), 'utf8')
const file = readFile(path.join(path.resolve(), 'src/241009 마크다운 문법 소개.md'))
const templatized = templatize(template, {
    date: file.data.date,
    title: file.data.title,
    content: file.html
})

console.log(templatized)