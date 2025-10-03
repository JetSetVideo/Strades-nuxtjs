export default defineEventHandler(async (event) => {
  try {
    const { readFile } = await import('node:fs/promises')
    const { resolve } = await import('node:path')

    const filePath = resolve('./public/data/PATH')
    const fileContent = await readFile(filePath, 'utf-8')
    const data = JSON.parse(fileContent)

    return data
  } catch (error) {
    console.error('Error loading data:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load data'
    })
  }
})
