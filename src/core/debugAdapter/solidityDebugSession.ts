import {
  LoggingDebugSession,
  InitializedEvent,
  TerminatedEvent,
  StoppedEvent,
  OutputEvent,
  Thread,
  StackFrame,
  Scope,
  Source,
  Handles,
} from "@vscode/debugadapter"
import { DebugProtocol } from "@vscode/debugprotocol"
import { StateCollector } from "../stateProcessor/stateCollector"
import * as vscode from "vscode"
import * as path from "path"

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  contractPath?: string
  networkName?: string
  additionalArgs?: string[]
}

/**
 * A Debug Adapter that bridges DAP with Ethereum JSON-RPC
 */
export class SolidityDebugSession extends LoggingDebugSession {
  private static THREAD_ID = 1

  private _configurationDone = new Promise<void>((resolve) => {
    this._configurationDoneHandler = resolve
  })
  private _configurationDoneHandler!: () => void

  private _variableHandles = new Handles<string>()
  private _workspaceRoot: string
  private _stateCollector: StateCollector

  constructor(workspaceRoot: string, stateCollector: StateCollector) {
    super("solidity-debug.txt")
    this._workspaceRoot = workspaceRoot
    this._stateCollector = stateCollector
    this.setDebuggerLinesStartAt1(false)
    this.setDebuggerColumnsStartAt1(false)
  }

  /**
   * The 'initialize' request is the first request called by the frontend
   * to interrogate the features the debug adapter provides.
   */
  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    _args: DebugProtocol.InitializeRequestArguments,
  ): void {
    response.body = response.body || {}

    // The adapter implements the configurationDoneRequest.
    response.body.supportsConfigurationDoneRequest = true

    // The adapter supports stepping back
    response.body.supportsStepBack = false

    // The adapter supports changing variable values
    response.body.supportsSetVariable = false

    // The adapter supports reading memory
    response.body.supportsReadMemoryRequest = false

    this.sendResponse(response)

    // Since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
    // we request them early by sending an 'initialized' event to the frontend.
    this.sendEvent(new InitializedEvent())
  }

  /**
   * Called at the end of the configuration sequence.
   * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
   */
  protected configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
    args: DebugProtocol.ConfigurationDoneArguments,
  ): void {
    super.configurationDoneRequest(response, args)
    this._configurationDoneHandler()
  }

  protected async launchRequest(response: DebugProtocol.LaunchResponse, _args: LaunchRequestArguments) {
    // Wait for configuration has finished (and configurationDoneRequest has been called)
    await this._configurationDone

    // Start the implementation
    this.sendEvent(new OutputEvent(`Starting Solidity Debugger in ${this._workspaceRoot}\n`))

    // For now, we simulate stopping at entry
    this.sendEvent(new StoppedEvent("entry", SolidityDebugSession.THREAD_ID))
    
    this.sendResponse(response)
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    // We only support one thread: the "EVM Main Thread"
    response.body = {
      threads: [new Thread(SolidityDebugSession.THREAD_ID, "EVM Main Thread")],
    }
    this.sendResponse(response)
  }

  protected stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    _args: DebugProtocol.StackTraceArguments,
  ): void {
    // In a real implementation, we would map EVM stack to Solidity source lines
    // For now, we return a single frame pointing to the contract
    
    const contractName = this._stateCollector.getCurrentContractName() || "Contract"
    
    response.body = {
      stackFrames: [
        new StackFrame(
          0, 
          "main", 
          new Source(contractName + ".sol"), 
          1 // Line number (dummy)
        )
      ],
      totalFrames: 1
    }
    this.sendResponse(response)
  }

  protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
    const frameId = args.frameId
    const scopes: Scope[] = []

    // 1. Local Scope
    scopes.push(
      new Scope(
        "Local",
        this._variableHandles.create("local_scope"),
        false
      )
    )

    // 2. State Scope
    scopes.push(
      new Scope(
        "Storage",
        this._variableHandles.create("storage_scope"),
        false
      )
    )

    response.body = {
      scopes,
    }
    this.sendResponse(response)
  }

  protected async variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments,
    _request?: DebugProtocol.Request,
  ): Promise<void> {
    const variables: DebugProtocol.Variable[] = []
    const handle = this._variableHandles.get(args.variablesReference)

    if (handle === "storage_scope") {
      // Get storage variables from StateCollector
      const currentState = this._stateCollector.getCurrentState()
      
      for (const [key, info] of Object.entries(currentState)) {
        variables.push({
           name: key,
           type: (info as any).type || "string",
           value: (info as any).displayValue || "0",
           variablesReference: 0
        })
      }
    } else if (handle === "local_scope") {
        // Mock locals for now
        variables.push({
            name: "msg.sender",
            type: "address",
            value: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
            variablesReference: 0
        })
    }

    response.body = {
      variables,
    }
    this.sendResponse(response)
  }
  
  protected nextRequest(response: DebugProtocol.NextResponse, _args: DebugProtocol.NextArguments): void {
    // When "next" is clicked, we should advance the trace step in StateCollector
    // and fire a StoppedEvent again
    
    this.sendEvent(new OutputEvent("Stepping...\n"))
    this.sendEvent(new StoppedEvent("step", SolidityDebugSession.THREAD_ID))
    this.sendResponse(response)
  }
}
