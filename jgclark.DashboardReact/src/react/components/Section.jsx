// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show a whole Dashboard Section
// Called by Dashboard compponent
// Last updated 10.5.2024 for v2.0.0 by @jgclark
//--------------------------------------------------------------------------
import React, { useState } from 'react'
import type { TSection, TSectionItem } from '../../types.js'
import { getFeatureFlags } from '../../shared.js'
import useInteractiveProcessing from '../customHooks/useInteractiveProcessing.jsx'
import CommandButton from './CommandButton.jsx'
import ItemGrid from './ItemGrid.jsx'
import { useAppContext } from './AppContext.jsx'
import { logDebug, logError, clo, JSP } from '@helpers/react/reactDev'

type SectionProps = {
  section: TSection
}

/**
 * Represents a section within the dashboard, like Today, Yesterday, Projects, etc.
 */
function Section(inputObj: SectionProps): React$Node {

  const [itemsCopy, setItemsCopy] = useState < Array < TSectionItem >> ([])

  try {
    const { section } = inputObj
    const items: Array<TSectionItem> = section.sectionItems
    const { sharedSettings, reactSettings, setReactSettings, pluginData, sendActionToPlugin } = useAppContext()

    // in destructuring rename "featureFlags" to 'ffStr':
    const { FFlag_InteractiveProcessing } = getFeatureFlags(pluginData.settings, sharedSettings)

    useInteractiveProcessing(items, section, itemsCopy, setItemsCopy, reactSettings, setReactSettings, sendActionToPlugin)

    // Check to see if we want to see this section
    if (sharedSettings && section.showSettingName && sharedSettings[section.showSettingName] === false) {
      // logDebug('Section', `Section: ${section.ID} ("${section.name}") is currently filtered out sharedSettings?.[section.showSettingName]=${sharedSettings?.[section.showSettingName]}`)
      return
    }

    if (!section /* || isNaN(section.ID) */) {
      throw new Error(`❓Section doesn't exist. ${JSP(section)}`)
    } else if (!section.sectionItems || section.sectionItems.length === 0) {
      if (section.ID !== 0) {
        // logDebug('Section', `Section: ${section.ID} / ${section.sectionCode} doesn't have any sectionItems, so not displaying.`)
        return
      } else {
        // As there are no items in first section, then add a congratulatory message
        // logDebug('Section', `Section 0 doesn't have any sectionItems, so display congrats message`)
        items.push({
          ID: '0-Congrats',
          itemType: 'congrats',
          // noteType: 'Notes', // for sake of something
          // Note: no para
        })
      }
    } else {
      // logDebug(`Section`, `Section: ${section.ID} / ${section.sectionCode} with ${section.sectionItems.length} items`)
    }

    // Produce set of actionButtons, if present
    const buttons = section.actionButtons?.map((item, index) => <CommandButton key={index} button={item} />) ?? []

    // Filter down by priority (if desired)
    const filterPriorityItems = sharedSettings?.filterPriorityItems ?? false
    let maxPrioritySeen = 0
    for (const i of items) {
      if (i.para?.priority && i.para.priority > maxPrioritySeen) {
        maxPrioritySeen = i.para.priority
      }
    }
    // logDebug('Section', `- config.filterPriorityItems = ${String(filterPriorityItems)}, maxPrioritySeen=${String(maxPrioritySeen)}`)
    const filteredItems = filterPriorityItems ? items.filter((f) => (f.para?.priority ?? 0) >= maxPrioritySeen) : items.slice()
    const priorityFilteringHappening = items.length > filteredItems.length
    // logDebug('Section', `- After filter, ${String(filteredItems.length)} from ${String(items.length)} items (${String(priorityFilteringHappening)})`)

    // Now sort the items by startTime, then by endTime, then by priority, then title
    // TEST: 12-hour times once I've coded for that in dataGeneration.
    // TODO: can we use an earlier helper here? (This was from Copilot++)
    // logDebug('Section', `- Before sort:\n${JSON.stringify(filteredItems, null, 2)}`)
    filteredItems.sort((a, b) => {
      // Compare by startTime
      if (a.para?.startTime && b.para?.startTime) {
        const startTimeComparison = a.para.startTime.localeCompare(b.para.startTime)
        if (startTimeComparison !== 0) return startTimeComparison
      } else if (a.para?.startTime) {
        return -1
      } else if (b.para?.startTime) {
        return 1
      }

      // Compare by endTime
      if (a.para?.endTime && b.para?.endTime) {
        const endTimeComparison = a.para.endTime.localeCompare(b.para.endTime)
        if (endTimeComparison !== 0) return endTimeComparison
      } else if (a.para?.endTime) {
        return -1
      } else if (b.para?.endTime) {
        return 1
      }

      // Compare by priority
      const priorityA = a.para?.priority ?? 0
      const priorityB = b.para?.priority ?? 0
      if (priorityA !== priorityB) {
        return priorityB - priorityA // Higher priority first
      }

      // Finally, compare by title
      const titleA = a.para?.title?.toLowerCase() ?? ''
      const titleB = b.para?.title?.toLowerCase() ?? ''
      return titleA.localeCompare(titleB)
    })
    // logDebug('Section', `- After sort:\n${JSON.stringify(filteredItems, null, 2)}`)

    // Now apply limit (if desired)
    const limit = 20 // sharedSettings?.maxTasksToShowInSection ?? 20
    const itemsToShow = filteredItems.slice(0, limit)
    // Caclculate how many are not shown: not as simple as 'items.length - itemsToShow.length'
    // because there can be a pre-filter in Overdue generation, given by section.totalCount
    const filteredOut = section.totalCount ? section.totalCount - itemsToShow.length : items.length - itemsToShow.length
    const limitApplied = (section.totalCount ?? 0) > itemsToShow.length
    // logDebug('Section', `- selected ${itemsToShow.length} visible items, with ${String(filteredOut)} filtered out (and potentially using maxTasksToShowInSection ${String(limit)})`)

    // Send an extra line if we've applied filtering/limit
    if (filteredOut > 0) {
      itemsToShow.push({
        ID: `${section.ID}-Filter`,
        itemType: 'filterIndicator',
        para: {
          content: `There are also ${filteredOut} ${priorityFilteringHappening ? 'lower-priority' : ''} items currently hidden`,
          filename: '',
          type: 'text', // for want of something else
          noteType: 'Notes', // for want of something else
          rawContent: '',// for want of something else
          priority: -1, // for want of something else
        },
      })
    }

    // If nothing to show, return nothing
    if (itemsToShow.length === 0) {
      logDebug('Section', `Section ${section.ID} / ${section.sectionCode}: No items to show`)
      return
    }

    // Insert items count
    let descriptionToUse = section.description
    if (descriptionToUse.includes('{count}')) {
      if (limitApplied) {
        descriptionToUse = descriptionToUse.replace('{count}', `<span id='section${section.ID}Count'>first ${String(itemsToShow.length)}</span>`)
      } else {
        descriptionToUse = descriptionToUse.replace('{count}', `<span id='section${section.ID}Count'>${String(itemsToShow.length)}</span>`)
      }
    }
    if (descriptionToUse.includes('{totalCount}')) {
      descriptionToUse = descriptionToUse.replace('{totalCount}', `<span id='section${section.ID}TotalCount'}>${String(filteredOut)}</span>`)
    }

    const handleProcessTasksClick = (e: MouseEvent): void => {
      const clickPosition = { clientY: e.clientY, clientX: e.clientX + 200 /* push it off the left edge a little */ }
      setReactSettings(prevSettings => ({
        ...prevSettings,
        lastChange: `_ProcessTasksClick`,
        interactiveProcessing: section.name /* clickPosition save to keep track of where it was clicked and not the action buttons clicks */,
        currentOverdueIndex: 0,
        dialogData: { isOpen: false, isTask: true, details: {}, clickPosition: prevSettings.interactiveProcessing || clickPosition }
      }))
    }

    const hideSection = !items.length || (sharedSettings && sharedSettings[`${section.showSettingName}`] === false)
    const sectionIsRefreshing = Array.isArray(pluginData.refreshing) && pluginData.refreshing.includes(section.sectionCode)

    return hideSection ? null : (
      <div className="section">
        <div className="sectionInfo">
          <div className={`${section.sectionTitleClass} sectionName`}>
            <i className={`sectionIcon ${section.FAIconClass || ''}`}></i>
            {section.sectionCode === 'TAG' ? section.name.replace(/^[#@]/, '') : section.name}
            {sectionIsRefreshing ? <i className="fa fa-spinner fa-spin"></i> : null}
          </div>{' '}
          <div className="sectionDescription" dangerouslySetInnerHTML={{ __html: descriptionToUse }}></div>
          <div className="sectionButtons">
            {buttons}
            {section.sectionItems.length /* && section.sectionCode === "OVERDUE" */ && FFlag_InteractiveProcessing && (
              <>
                <span className="fa-layers fa-fw" onClick={handleProcessTasksClick} title="Interactively process tasks one at a time">
                  <i className="fa-solid  fa-arrows-rotate" style="opacity:0.25"></i>
                  <span className="fa-layers-text" data-fa-transform="shrink-8 " style="font-weight:900; ">{items.length}</span>
                </span>
                <button className="fa-layers fa-fw" onClick={handleProcessTasksClick} title="Interactively process tasks one at a time">
                  <i className="fa-solid  fa-arrows-rotate" style="opacity:0.25"></i>
                  <span className="fa-layers-text" data-fa-transform="shrink-8 " style="font-weight:900; ">{items.length}</span>
                </button>
                <button className="PCButton" onClick={handleProcessTasksClick} title="Interactively process tasks one at a time">
                  Process Tasks <i className="fa-regular fa-person-digging"></i>
                </button>
              </>
            )}
          </div>
        </div>
        <ItemGrid thisSection={inputObj.section} items={itemsToShow} />
      </div>
    )
  } catch (error) {
    logError('Section', `${error.message}`)
  }
}
export default Section
