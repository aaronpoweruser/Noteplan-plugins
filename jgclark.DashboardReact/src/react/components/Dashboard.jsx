// @flow
//--------------------------------------------------------------------------
// Dashboard React component to aggregate data and layout for the dashboard
// Called by parent component.
// Last updated 2024-05-28 for v2.0.0 by @dwertheimer
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
// Imports
//--------------------------------------------------------------------------
import React, { useEffect, useRef } from 'react'
import { getSectionsWithoutDuplicateLines, countTotalVisibleSectionItems, sortSections } from '../support/sectionHelpers.js'
import { findSectionItems } from '../../dataGeneration.js'
import { allSectionDetails, sectionDisplayOrder } from "../../constants.js"
import { getSettingsRedacted, getFeatureFlags } from '../../shared.js'
import useWatchForResizes from '../customHooks/useWatchForResizes.jsx'
import Header from './Header.jsx'
import Section from './Section.jsx'
import ToolTipOnModifierPress from './ToolTipOnModifierPress.jsx'
import Dialog from './Dialog.jsx'
import IdleTimer from './IdleTimer.jsx'
import { useAppContext } from './AppContext.jsx'
import { logDebug, clo, JSP } from '@helpers/react/reactDev.js'

//--------------------------------------------------------------------------
// Type Definitions
//--------------------------------------------------------------------------
declare var globalSharedData: {
  pluginData: {
    sections: Array<Object>,
  },
};

type Props = {
  pluginData: Object /* the data that was sent from the plugin in the field "pluginData" */,
}

//--------------------------------------------------------------------------
// Dashboard Component Definition
//--------------------------------------------------------------------------
const Dashboard = ({ pluginData }: Props): React$Node => {
  //----------------------------------------------------------------------
  // Context
  //----------------------------------------------------------------------
  const { reactSettings, setReactSettings, sendActionToPlugin, sharedSettings } = useAppContext()
  const { sections: origSections, lastFullRefresh } = pluginData
  const redactedSettings = getSettingsRedacted(pluginData.settings) // get all the settings except for sharedSettings & reactSettings
  const { FFlag_MetaTooltips, FFlag_AutoRefresh } = getFeatureFlags(redactedSettings, sharedSettings)

  //----------------------------------------------------------------------
  // Hooks
  //----------------------------------------------------------------------
  useWatchForResizes(sendActionToPlugin)

  //----------------------------------------------------------------------
  // Refs
  //----------------------------------------------------------------------
  const containerRef = useRef <? HTMLDivElement > (null)

  //----------------------------------------------------------------------
  // State
  //----------------------------------------------------------------------

  //----------------------------------------------------------------------
  // Constants
  //----------------------------------------------------------------------
  const metaKeyConfig = { text: 'Meta Key Pressed', style: { color: 'red' } }
  const shiftKeyConfig = { text: 'Shift Key Pressed', style: { color: 'blue' } }
  const ctrlKeyConfig = { text: 'Ctrl Key Pressed', style: { color: 'green' } }
  const altKeyConfig = { text: 'Alt Key Pressed', style: { color: 'yellow' } }
  const sectionPriority = ['TAG', 'DT', 'DY', 'DO', 'W', 'M', 'Q', 'OVERDUE'] // change this order to change which duplicate gets kept - the first on the list

  let sections = origSections
  const unduplicatedSections = sections.length === 1
    ? sections
    : (sharedSettings
      ? getSectionsWithoutDuplicateLines(origSections.slice(), ['filename', 'content'], sectionPriority, sharedSettings)
      : [])
  sections = sharedSettings?.hideDuplicates ? unduplicatedSections : origSections
  sections = sortSections(sections, sectionDisplayOrder)

  const dashboardContainerStyle = {
    maxWidth: '98vw',
    width: '98vw',
  }

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------
  // Force the window to be focused on load so that we can capture clicks on hover
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus()
    }
  }, [])

  // temporary code to output variable changes to Chrome DevTools console
  const logChanges = (label: string, value: any) => (!window.webkit) ? logDebug(`Dashboard`, `${label}${!value || Object.keys(value).length===0 ? ' (not intialized yet)' : ' changed vvv'}`, value) : null
  useEffect(() => {
    (sharedSettings && Object.keys(sharedSettings).length > 0) ? logChanges('sharedSettings', sharedSettings) : null
  }, [sharedSettings])
  useEffect(() => {
    logChanges('reactSettings', reactSettings)
  }, [reactSettings])
  useEffect(() => {
    logChanges('pluginData', pluginData)
  }, [pluginData])

  // Load the rest of the content (Today section loads first)
  useEffect(() => {
    // if we did a force reload (DEV only) of the full sections data, no need to load the rest
    // but if we are doing a normal load, then get the rest of the section data incrementally
    // this executes before globalSharedData is saved into state 
    logDebug('Dashboard', `lastFullRefresh: ${lastFullRefresh} and FFlag_AutoRefresh: ${FFlag_AutoRefresh} and sections.length: ${sections.length}`)
    if (sections.length <= 2) {
      const sectionCodes = allSectionDetails.slice(1).map(s => s.sectionCode)
      sendActionToPlugin('incrementallyRefreshSections', { actionType: 'incrementallyRefreshSections', sectionCodes }, 'Dashboard loaded', true)
    }
  }, [])

  // Change the title when the section data changes
  // TODO: this doesn't work and I'm not sure it ever can
  useEffect(() => {
    const totalUnduplicatedSectionItems = countTotalVisibleSectionItems(unduplicatedSections, sharedSettings)
    const windowTitle = `Dashboard (React) - ${totalUnduplicatedSectionItems} items`
    if (document.title !== windowTitle) {
      logDebug('Dashboard', `in useEffect, setting title to: ${windowTitle}`)
      document.title = windowTitle
    }
  }, [pluginData.sections])

  // when reactSettings changes anywhere, send it to the plugin to save in settings
  // if you don't want the info sent, use a _ for the first char of lastChange
  useEffect(() => {
    if (reactSettings?.lastChange && typeof reactSettings.lastChange === 'string' && reactSettings.lastChange.length > 0 && reactSettings.lastChange[0] !== '_') {
      const trimmedReactSettings = { ...reactSettings, lastChange: '_Saving', dialogData: { isOpen: false, isTask: true, details: {} } }
      const strReactSettings = JSON.stringify(trimmedReactSettings)
      sendActionToPlugin('reactSettingsChanged', { actionType: 'reactSettingsChanged', settings: strReactSettings }, 'Dashboard reactSettings updated', true)
    }
  }, [reactSettings])

  // when sharedSettings changes anywhere, send it to the plugin to save in settings
  // if you don't want the info sent, use a _ for the first char of lastChange
  useEffect(() => {
    if (sharedSettings?.lastChange && typeof sharedSettings.lastChange === 'string' && sharedSettings.lastChange.length > 0 && sharedSettings.lastChange[0] !== '_') {
      logDebug('Dashboard', `Watcher for sharedSettings changes. Shared settings updated: "${sharedSettings.lastChange}" sending to plugin to be saved`, sharedSettings)
      const strSharedSetings = JSON.stringify(sharedSettings)
      sendActionToPlugin('sharedSettingsChanged', { actionType: 'sharedSettingsChanged', settings: strSharedSetings }, 'Dashboard sharedSettings updated', true)
    } else if (sharedSettings && Object.keys(sharedSettings).length > 0) {
      // logDebug('Dashboard', `Watcher for sharedSettings changes. Shared settings updated: ${JSON.stringify(sharedSettings,null,2)}`,sharedSettings)
    }
  }, [sharedSettings])

  // Update dialogData when pluginData changes, e.g. when the dialog is open and you are changing things like priority
  useEffect(() => {
    if ((!reactSettings?.dialogData || !reactSettings.dialogData.isOpen)) return
    const { dialogData } = reactSettings
    const { details: dialogItemDetails } = dialogData
    if (!dialogData.isOpen || !dialogItemDetails) return
    // Note, dialogItemDetails (aka dialogData.details) is a MessageDataObject
    logDebug('Dashboard', `dialogData?.details?.item=${JSP(dialogItemDetails?.item, 2)}`)
    if (!(dialogData?.details?.item)) return
    if (dialogItemDetails?.item?.ID) {
      const { ID: openItemInDialogID } = dialogItemDetails.item
      const sectionIndexes = findSectionItems(origSections, ['ID'], { ID: openItemInDialogID })
      logDebug('Dashboard', `sectionIndexes: ${JSP(sectionIndexes, 2)}`)
      if (!sectionIndexes?.length) return
      const firstMatch = sectionIndexes[0]
      const newSectionItem = sections[firstMatch.sectionIndex].sectionItems[firstMatch.itemIndex]
      clo(`Dashboard: in useEffect on dialog details change, previous dialogData=${JSP(reactSettings?.dialogData)}`)
      if (newSectionItem && JSON.stringify(newSectionItem) !== JSON.stringify(dialogData?.details?.item)) {
        logDebug('Dashboard', `in useEffect on dialog details change, newSectionItem: ${JSP(newSectionItem, 2)}\n...will update dialogData`)
        setReactSettings(prev => {
          const newData = {
            ...prev,
            dialogData: {
              ...prev.dialogData,
              details: {
                ...prev.dialogData.details, item: newSectionItem
              }
            },
            lastChange: '_Dialog was open, and data changed underneath'
          }
          logDebug('Dashboard', `in useEffect on dialog details change, setting reactSettings to: ${JSP(newData, 2)}`)
          return newData
        })
      } else {
        logDebug('Dashboard', `in useEffect on dialog details change, newSectionItem did not change from previous: ${JSP(newSectionItem, 2)}`)
      }
    }
  }, [pluginData, setReactSettings, reactSettings?.dialogData])

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------
  const handleDialogClose = (xWasClicked: boolean = false) => {
    const interactiveProcessing = xWasClicked ? { interactiveProcessing: false, dialogData: { isOpen: false, details: null } } : {}
    setReactSettings((prev) => ({ ...prev, dialogData: { ...prev.dialogData, isOpen: false }, lastChange: `_Dashboard-DialogClosed`, ...interactiveProcessing }))
  }

  const autoRefresh = () => {
    logDebug('Dashboard', `${new Date().toString()} Auto-Refresh time!`)
    const actionType = 'refresh'
    sendActionToPlugin(actionType, { actionType }, 'Auto-Refresh time!', true)
  }

  //----------------------------------------------------------------------
  // Render
  //----------------------------------------------------------------------
  if (sections.length === 0) {
    return null
  }
  return (
    <div style={dashboardContainerStyle} tabIndex={0} ref={containerRef}>
      {FFlag_AutoRefresh && (
        <IdleTimer
          idleTime={parseInt(sharedSettings?.autoUpdateAfterIdleTime?.length ? sharedSettings.autoUpdateAfterIdleTime : "5") * 60 * 1000 /* 5 minutes default */}
          onIdleTimeout={autoRefresh}
        />
      )}
      <div className="dashboard">
        <Header lastFullRefresh={lastFullRefresh} />
        {sections.map((section, index) => (
          <Section key={index} section={section} />
        ))}
        <Dialog
          onClose={handleDialogClose}
          isOpen={reactSettings?.dialogData?.isOpen ?? false}
          isTask={reactSettings?.dialogData?.isTask ?? false}
          details={reactSettings?.dialogData?.details ?? {}}
        />
      </div>
      {FFlag_MetaTooltips && !(reactSettings?.dialogData?.isOpen) && (
        <ToolTipOnModifierPress
          metaKey={metaKeyConfig}
          shiftKey={shiftKeyConfig}
          ctrlKey={ctrlKeyConfig}
          altKey={altKeyConfig}
          disappearAfter={2000} /* milliseconds */
        />
      )}
    </div>
  )
}

export default Dashboard
