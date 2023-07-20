import React from "react"
import ReactDOM from 'react-dom'
import {
  Streamlit,
  StreamlitComponentBase,
  withStreamlitConnection,
  ComponentProps,
} from "streamlit-component-lib"
import FileBrowser, {
  Icons,
  FileBrowserFile,
  FileBrowserFolder,
} from "react-keyed-file-browser"

import get from 'lodash.get'
import IframeResizer from 'iframe-resizer-react'
import Actions from "./actions"
import "react-keyed-file-browser/dist/react-keyed-file-browser.css"
import "font-awesome/css/font-awesome.min.css"

interface JSFile extends Blob {
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/File/lastModified) */
  readonly lastModified: number;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/File/name) */
  readonly name: string;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/File/webkitRelativePath) */
  readonly webkitRelativePath: string;
}

interface File {
  path: string
  name?: string
  size?: number
  create_time?: number
  update_time?: number
  access_time?: number
}

enum StreamlitEventType {
  SELECT_FILE = "SELECT_FILE",
  SELECT_FOLDER = "SELECT_FOLDER",
  DOWNLOAD = "DOWNLOAD",
  DELETE_FILE = "DELETE_FILE",
  DELETE_FOLDER = "DELETE_FOLDER",
  RENAME_FOLDER = "RENAME_FOLDER",
  RENAME_FILE = "RENAME_FILE",
  CREATE_FILE = "CREATE_FILE",
  CREATE_FOLDER = "CREATE_FOLDER",
  MOVE_FILE = "MOVE_FILE",
  MOVE_FOLDER = "MOVE_FOLDER",
  CHOOSE_FILE = "CHOOSE_FILE",
}

interface StreamlitEvent {
  type: StreamlitEventType
  target: File | File[]
}

interface State {
  numClicks: number
  isFocused: boolean
}

interface IArgs {
  files: File[]
  path: string
  artifacts_download_site: string
  show_download_file: boolean
  show_delete_file: boolean
  show_choose_file: boolean
  show_new_folder: boolean
  show_delete_folder: boolean
  show_upload_file: boolean
  ignore_file_select_event: boolean
  static_file_server_path: string
}

const noticeStreamlit = (event: StreamlitEvent) =>
  Streamlit.setComponentValue(event)

class FileBrowserStaticServer extends StreamlitComponentBase<State> {
  private args: IArgs
  
  constructor(props: ComponentProps) {
    super(props)
    this.args = props.args
  }

  ajustHeight(revoke_step?: number) {
    Streamlit.setFrameHeight()
  }
  
  componentDidMount(): void {
    const root = this.args.path
    const args = this.args;
    window.addEventListener('message', function(event) {
      // console.log('从 iframe 中传递过来的点击事件:', event.data);
      if (
        event.data?.event === "filebrowser_file_selected" ||
        event.data?.event === "filebrowser_dir_selected" ||
        event.data?.event === "filebrowser_file_double_selected" ||
        event.data?.event === "filebrowser_path_changed" ||
        event.data?.event === "filebrowser_file_choose"
      ) {
        const file: File = {
          path: get(event, 'data.data.file.path', ''),
        }
        get(event, 'data.data.file.name', '') && (file.name = get(event, 'data.data.file.name', ''))
        get(event, 'data.data.file.size', 0) && (file.size = get(event, 'data.data.file.size', 0))
        get(event, 'data.data.file.create_time', 0) && (file.create_time = get(event, 'data.data.file.create_time', 0))
        get(event, 'data.data.file.update_time', 0) && (file.update_time = get(event, 'data.data.file.update_time', 0))
        get(event, 'data.data.file.access_time', 0) && (file.access_time = get(event, 'data.data.file.access_time', 0))

        event.data?.event === "filebrowser_file_selected" && noticeStreamlit({ type: StreamlitEventType.SELECT_FILE, target: file })
        event.data?.event === "filebrowser_dir_selected" && noticeStreamlit({ type: StreamlitEventType.SELECT_FOLDER, target: file })
        const { show_choose_file } = args;
        event.data?.event === "filebrowser_file_double_selected" && show_choose_file && noticeStreamlit({ type: StreamlitEventType.CHOOSE_FILE, target: [file] })
        event.data?.event === "filebrowser_file_choose" && show_choose_file && noticeStreamlit({ type: StreamlitEventType.CHOOSE_FILE, target: [file] })
        event.data?.event === "filebrowser_path_changed" && noticeStreamlit({ type: StreamlitEventType.SELECT_FOLDER, target: file })
      }
    });
    this.ajustHeight()
  }

  componentDidUpdate() {
    this.ajustHeight()
  }

  onResized = (size: any) => {
    this.ajustHeight()
  }

  public render = () => {
    return (
      <IframeResizer
        {...this.args}
        checkOrigin={false}
        autoResize
        onResized={this.onResized}
        frameBorder={0}
        style={{ width: '100%' }}
        src={this.args.static_file_server_path}
      />
    )

  }
}
  
class FileBrowserNative extends StreamlitComponentBase<State> {
  private args: IArgs
  private deleted: boolean

  constructor(props: ComponentProps) {
    super(props)
    this.args = props.args
    this.deleted = false
    console.log(props.args)
  }

  ajustHeight(revoke_step?: number) {
    const root = document.getElementById("root")
    if (root) {
      const height = Math.min(
        root.clientHeight,
        root.scrollHeight,
        root.offsetHeight
      )
      Streamlit.setFrameHeight(height - (revoke_step ? revoke_step : 0))
      setTimeout(Streamlit.setFrameHeight, 1)
    }
  }

  componentDidMount() {
    /*let that = this
    window.addEventListener('message', function(event) {
      console.log(event);
      //that.args = event?.data?.args ?? that.args
    });*/
    this.ajustHeight()
  }

  componentDidUpdate() {
    this.ajustHeight()
  }

  folderOpenHandler = (opts: FileBrowserFolder) => this.ajustHeight()
  
  folderCloseHandler = (opts: FileBrowserFolder) => this.ajustHeight()

  folderSelectHandler = (opts: FileBrowserFolder) => {
    if (typeof opts !== 'undefined')
    {
      let name = opts?.key.includes("/") ? opts?.key.split("/").slice(-2)[0] : opts?.key
      const file = {path: opts?.key, name: name}
      file && noticeStreamlit({ type: StreamlitEventType.SELECT_FOLDER, target: file })
    }
  }

  createFolderHandler = (key: string) => {
    let name = key.includes("/") ? key.split("/").slice(-2)[0] : key
    const file = {path: key, name: name}
    this.args.files = this.args.files.concat([file])
    file && noticeStreamlit({ type: StreamlitEventType.CREATE_FOLDER, target: file })
  }

  createFilesHandler = (files: JSFile[], prefix: string) => {
    console.log(files)
    console.log(prefix)
  }

  fileSelectedHandler = (opts: FileBrowserFile) => {
    if (!this.args.ignore_file_select_event) {
      const file = this.args.files.find((file) => file.path === opts.key)
      file &&
        noticeStreamlit({ type: StreamlitEventType.SELECT_FILE, target: file })
    }
  }

  downlandHandler = (keys: string[]) => {
    const files = this.args.files.filter((file) => keys.includes(file.path))
    files.forEach((file) => {
      let url = new URL(file.path, this.args.artifacts_download_site).toString()
      let filename = url.substring(url.lastIndexOf("/") + 1)
      let a = document.createElement("a")
      a.target = "_blank"
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.parentNode?.removeChild(a)
    })
    files.length &&
      noticeStreamlit({ type: StreamlitEventType.DOWNLOAD, target: files })
  }

  deleteFileHandler = (fileKey: string | string[]) => {
    let files = this.args.files.filter((file) => typeof fileKey === 'string' ? fileKey === file.path : fileKey.includes(file.path))
    files = files.filter((file) => !file.path.endsWith("/"))
    console.log("deleteFileHandler", "key", fileKey, "files ", files)

    files.length &&
      noticeStreamlit({ type: StreamlitEventType.DELETE_FILE, target: files })

    //const remainingFiles = this.args.files.filter((file) => typeof fileKey === 'string' ? fileKey !== file.path : !fileKey.includes(file.path))
    const remainingFiles = this.args.files.filter((file) => !files.includes(file))
    console.log(remainingFiles)
    this.args.files = remainingFiles
    this.deleted = true
  }

  deleteFolderHandler = (folderKey: string) => {
    
    // const files = this.args.files.filter((file) => typeof folderKey === 'string' ? folderKey === file.path : folderKey.includes(file.path))
    const files = this.args.files.filter((file) => file.path.startsWith(folderKey))
    console.log("deleteFolderHandler", "key", folderKey, "files ", files)

    files.length &&
      noticeStreamlit({ type: StreamlitEventType.DELETE_FOLDER, target: files })
    
    console.log(this.args.files)
    console.log(typeof folderKey)
    // const remainingFiles = this.args.files.filter((file) => typeof folderKey === 'string' ? !file.path.startsWith(folderKey) : !folderKey.includes(file.path))
    const remainingFiles = this.args.files.filter((file) => !file.path.startsWith(folderKey))
    console.log(remainingFiles)
    this.args.files = remainingFiles
    this.deleted = true
  }

  chooseHandler = (keys: string[]) => {
    const files = this.args.files.filter((file) => keys.includes(file.path))
    files.length &&
      noticeStreamlit({ type: StreamlitEventType.CHOOSE_FILE, target: files })
  }

  convertFiles = (files: File[]): FileBrowserFile[] =>
    files.map((file) => ({
      key: file.path,
      modified: file.update_time || 0,
      size: file.size || 0,
    }))

  noop = () => <></>
  public render = () => {
    let that = this
    if ((this.props.args.files.length > this.args.files.length) && !this.deleted) {
      console.log("files:", this.args.files)
      console.log("prop files:", this.props.args.files)
      this.args.files = this.props.args.files
    }
    console.log("files:", this.args.files)
    if (this.deleted) {
      console.log("deleted")
      this.props.args.files = this.args.files
      this.deleted = false
    }
    return (
      // <div>
        <FileBrowser
          {...this.args}
          showActionBar
          canFilter={true}
          detailRenderer={this.noop}
          icons={Icons.FontAwesome(4)}
          files={this.convertFiles(this.args.files)}
          onFolderOpen={this.folderOpenHandler}
          onFolderClose={this.folderCloseHandler}
          onSelectFile={this.fileSelectedHandler}
          onSelectFolder={this.folderSelectHandler}
          onDownloadFile={this.downlandHandler}
          onDeleteFile={this.deleteFileHandler}
          onDeleteFolder={this.deleteFolderHandler}
          onCreateFolder={this.createFolderHandler}
          onCreateFiles={this.createFilesHandler}
          actionRenderer={(...args: any) => {
            return Actions({
              ...args[0],
              ...{
                canCreateFolder: that.args.show_new_folder,
                canChooseFile: that.args.show_choose_file,
                canDownloadFile:
                  that.args.show_download_file &&
                  that.args.artifacts_download_site,
                canDeleteFile: that.args.show_delete_file,
                canDeleteFolder: that.args.show_delete_folder,
                onChooseFile: (keys: string[]) =>
                  that.chooseHandler(
                    args[0].selectedItems.map((i: any) => i.key)
                  ),
                onDeleteFile: (fileKey: string[]) =>
                  that.deleteFileHandler(
                      args[0].selectedItems.map((i: any) => i.key)
                  ),
                onDeleteFolder: (fileKey: string[]) =>
                  that.deleteFolderHandler(
                      args[0].selectedItems.map((i: any) => i.key)
                  ),
              },
            })
          }}
        />
      // </div>
    )
  }
}
const StreamlitFileBrowserNative = withStreamlitConnection(FileBrowserNative)
const StreamlitFileBrowserStaticServer = withStreamlitConnection(FileBrowserStaticServer)

class FileBrowserWrapper extends StreamlitComponentBase<State> {
  private args: IArgs
  
  constructor(props: ComponentProps) {
    super(props)
    console.log(props)
    this.args = props.args
  }

  public render(): React.ReactNode {
    if (this.args.static_file_server_path) {
      return (
        <div>
          <StreamlitFileBrowserStaticServer {...this.props} />
        </div>
      )
    } else {
      return (
        //<div>
          <StreamlitFileBrowserNative {...this.props} />
        //</div>
      )
    }
  }
}

export default withStreamlitConnection(FileBrowserWrapper)
