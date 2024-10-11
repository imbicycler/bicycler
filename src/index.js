import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import { marked, Lexer } from 'marked'
import { mkdirp } from 'mkdirp'
import { glob } from 'glob'
import sharp from 'sharp'
import ejs from 'ejs'

const SRC_PATH = path.join(path.resolve(), 'src')
const OUT_PATH = path.join(path.resolve(), 'dist')
const NOTES_PATTERN = path.join(SRC_PATH, 'notes/**/*.md')

const findAssetReferences = (markdownContent) => {
    const tokens = Lexer.lex(markdownContent);
    const paths = [];
  
    function walkTokens(tokens) {
      tokens.forEach((token) => {
        if (token.type === 'image' || token.type === 'link') {
          if (token.href && token.href.includes('assets/')) {
            paths.push(token.href);
          }
        } else if (token.type === 'paragraph' && token.tokens) {
          walkTokens(token.tokens);
        } else if (token.tokens) {
          walkTokens(token.tokens);
        }
      });
    }
  
    walkTokens(tokens);
    return paths;
}

const getOutputFilename = (filename) => {
    const relativePath = path.relative(path.join(SRC_PATH, 'notes'), filename)
    const dirname = path.dirname(relativePath)
    const basename = path.basename(filename, '.md')
    return path.join(OUT_PATH, 'notes', dirname, `${basename}.html`)
}

const saveFile = async (filename, content) => {
    try {
        const dir = path.dirname(filename)
        await mkdirp(dir)
        await fs.writeFile(filename, content)
    } catch (error) {
        console.error(`Error saving file ${filename}:`, error)
        throw error
    }
}

const copyAssets = async (assetReferences, srcDir, destDir, content) => {
    let updatedContent = content;
    for (const ref of assetReferences) {
        const srcPath = path.join(srcDir, 'notes', ref);
        const destPath = path.join(destDir, 'notes', 'assets', ref.replace('assets/', ''));
        
        try {
            await mkdirp(path.dirname(destPath));
            
            const ext = path.extname(srcPath).toLowerCase();
            if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
                const webpDestPath = destPath.replace(ext, '.webp');
                await sharp(srcPath)
                    .resize({ width: 1200, withoutEnlargement: true })
                    .webp({ quality: 80 })
                    .toFile(webpDestPath);
                console.log(`Converted and copied asset: ${srcPath} -> ${webpDestPath}`);
                
                updatedContent = updatedContent.replace(ref, ref.replace(ext, '.webp'));
            } else {
                await fs.copyFile(srcPath, destPath);
                console.log(`Copied asset: ${srcPath} -> ${destPath}`);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.warn(`Asset file not found: ${srcPath}`);
            } else {
                console.error(`Error processing asset ${srcPath}:`, error);
            }
        }
    }
    return updatedContent;
}

const getTemplateFile = (layout) => {
    return path.join(SRC_PATH, 'layouts', layout)
}

const processFile = async (filename) => {
    try {
        let fileContent = await fs.readFile(filename, 'utf8')
        const { data, content: originalContent } = matter(fileContent)
        const assetReferences = findAssetReferences(originalContent)
        
        const updatedContent = await copyAssets(assetReferences, SRC_PATH, OUT_PATH, originalContent)

        let renderedHtml
        if (data.layout) {
            const templateFile = getTemplateFile(data.layout)
            const template = await fs.readFile(templateFile, 'utf8')
            
            const html = marked(updatedContent)
            
            renderedHtml = ejs.render(template, {
                date: data.date,
                title: data.title,
                content: html
            })
        } else {
            renderedHtml = marked(updatedContent)
        }
        
        const outFilename = getOutputFilename(filename)
        await saveFile(outFilename, renderedHtml)
        console.log(`Processed: ${filename} -> ${outFilename}`)
    } catch (error) {
        console.error(`Error processing file ${filename}:`, error)
    }
}

const main = async () => {
    try {
        const markdownFilenames = await glob(NOTES_PATTERN)
        await Promise.all(markdownFilenames.map(filename => processFile(filename)))
        console.log('All files processed successfully')
    } catch (error) {
        console.error('An error occurred during processing:', error)
    }
}

main()