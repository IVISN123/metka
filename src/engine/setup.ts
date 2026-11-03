import { FabricObject, InteractiveFabricObject } from 'fabric'

const host = FabricObject as unknown as { customProperties: string[] }
if (!host.customProperties.includes('data')) {
  host.customProperties = [...host.customProperties, 'data']
}

Object.assign(InteractiveFabricObject.ownDefaults, {
  cornerColor: '#1d9bf0',
  cornerStrokeColor: '#1d9bf0',
  borderColor: '#1d9bf0',
  cornerStyle: 'circle',
  transparentCorners: false,
  cornerSize: 10,
  touchCornerSize: 28,
  padding: 2,
  borderScaleFactor: 1.5,
  centeredRotation: true,
})
