import * as fs from 'fs'
import minimist from 'minimist'
import {exit} from 'process'
import {IArchive} from '../../webapp/src/blocks/archive'
import {IBlock} from '../../webapp/src/blocks/block'
import {IPropertyOption, IPropertyTemplate, MutableBoard} from '../../webapp/src/blocks/board'
import {MutableBoardView} from '../../webapp/src/blocks/boardView'
import {MutableCard} from '../../webapp/src/blocks/card'
import {MutableTextBlock} from '../../webapp/src/blocks/textBlock'
import {Trello} from './trello'
import {Utils} from './utils'

// HACKHACK: To allow Utils.CreateGuid to work
(global.window as any) = {}

function main() {
    const args: minimist.ParsedArgs = minimist(process.argv.slice(2))

    const inputFile = args['i']
    const outputFile = args['o'] || 'archive.focalboard'

    if (!inputFile) {
        showHelp()
    }

    // Read input
    const inputData = fs.readFileSync(inputFile, 'utf-8')
    const input = JSON.parse(inputData) as Trello

    // Convert
    const output = convert(input)

    // Save output
    const outputData = JSON.stringify(output)
    fs.writeFileSync(outputFile, outputData)

    console.log(`Exported to ${outputFile}`)
}

function convert(input: Trello): IArchive {
    const blocks: IBlock[] = []

    // Board
    const board = new MutableBoard()
    console.log(`Board: ${input.name}`)
    board.rootId = board.id
    board.title = input.name
    board.description = input.desc

    // Convert lists (columns) to a Select property
    const optionIdMap = new Map<string, string>()
    const options: IPropertyOption[] = []
    input.lists.forEach(list => {
        const optionId = Utils.createGuid()
        optionIdMap.set(list.id, optionId)
        const option: IPropertyOption = {
            id: optionId,
            value: list.name,
            color: 'propColorDefault',
        }
        options.push(option)
    })

    const cardProperty: IPropertyTemplate = {
        id: Utils.createGuid(),
        name: 'List',
        type: 'select',
        options
    }
    board.cardProperties = [cardProperty]
    blocks.push(board)

    // Board view
    const view = new MutableBoardView()
    view.title = 'Board View'
    view.viewType = 'board'
    view.rootId = board.id
    view.parentId = board.id
    blocks.push(view)

    // Cards
    input.cards.forEach(card => {
        console.log(`Card: ${card.name}`)

        const outCard = new MutableCard()
        outCard.title = card.name
        outCard.rootId = board.id
        outCard.parentId = board.id

        // Map lists to Select property options
        if (card.idList) {
            const optionId = optionIdMap.get(card.idList)
            if (optionId) {
                outCard.properties[cardProperty.id] = optionId
            } else {
                console.warn(`Invalid idList: ${card.idList} for card: ${card.name}`)
            }
        } else {
            console.warn(`Missing idList for card: ${card.name}`)
        }

        blocks.push(outCard)

        if (card.desc) {
            // console.log(`\t${card.desc}`)
            const text = new MutableTextBlock()
            text.title = card.desc
            text.rootId = board.id
            text.parentId = outCard.id
            blocks.push(text)

            outCard.contentOrder = [text.id]
        }
    })

    const archive: IArchive = {
        version: 1,
        date: Date.now(),
        blocks
    }

    console.log('')
    console.log(`Found ${input.cards.length} card(s).`)

    return archive
}

function showHelp() {
    console.log('import -i <input.json> -o [output.focalboard]')
    exit(-1)
}

main()