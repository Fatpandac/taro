import { VUE_EXT } from '@tarojs/helper'
import { isString, isWebPlatform } from '@tarojs/shared'
import { capitalize, internalComponents, toCamelCase } from '@tarojs/shared/dist/template'

import { h5VitePlugin } from './vite.h5'
import { miniVitePlugin } from './vite.mini'
import { modifyH5WebpackChain } from './webpack.h5'
import { modifyMiniWebpackChain } from './webpack.mini'

import type { IPluginContext } from '@tarojs/service'
import type { IComponentConfig } from '@tarojs/taro/types/compile/hooks'
import type { PluginOption } from 'vite'


type CompilerOptions = {
  isCustomElement: (tag: string) => boolean
  whitespace: 'condense' | 'preserve'
  delimiters: string[]
  comments: boolean
  nodeTransforms: ((...args: any) => void)[]
}

interface OnParseCreateElementArgs {
  nodeName: string
  componentConfig: IComponentConfig
}

export interface IConfig {
  mini?: {
    compilerOptions: CompilerOptions
  }
  vueLoaderOption?: {
    compilerOptions: CompilerOptions
    [key: string]: any
  }
}

export default (ctx: IPluginContext, config: IConfig = {}) => {
  const { framework } = ctx.initialConfig
  if (framework !== 'vue') return

  ctx.modifyWebpackChain(({ chain, data }) => {
    // 通用
    if (process.env.NODE_ENV !== 'production') {
      setAlias(chain)
    }
    if (isWebPlatform()) {
      // H5
      modifyH5WebpackChain(ctx, chain)
    } else {
      // 小程序
      modifyMiniWebpackChain(chain, data)
    }
  })

  ctx.modifyViteConfig(({ viteConfig, componentConfig }) => {
    viteConfig.plugins.push(viteCommonPlugin())
    if (isWebPlatform()) {
      // H5
      viteConfig.plugins.push(h5VitePlugin(ctx, config))
    } else {
      // 小程序
      viteConfig.plugins.push(miniVitePlugin(componentConfig))
    }
  })

  ctx.modifyRunnerOpts(({ opts }) => {
    opts.frameworkExts = VUE_EXT

    if (!opts?.compiler) return

    if (isString(opts.compiler)) {
      opts.compiler = {
        type: opts.compiler
      }
    }

    const { compiler } = opts
    if (compiler.type === 'webpack5') {
      // 提供给 webpack5 依赖预编译收集器的第三方依赖
      const deps = [
        'vue',
        '@tarojs/plugin-framework-vue2/dist/runtime'
      ]
      compiler.prebundle ||= {}
      const prebundleOptions = compiler.prebundle
      prebundleOptions.include ||= []
      prebundleOptions.include = prebundleOptions.include.concat(deps)
      prebundleOptions.exclude ||= []
    }
  })

  ctx.onParseCreateElement(({ nodeName, componentConfig }: OnParseCreateElementArgs) => {
    if (capitalize(toCamelCase(nodeName)) in internalComponents) {
      componentConfig.includes.add(nodeName)
    }
  })
}

function setAlias (chain) {
  // 避免 npm link 时，taro composition apis 使用的 vue 和项目使用的 vue 实例不一致。
  chain.resolve.alias
    .set('vue', require.resolve('vue'))
}

function viteCommonPlugin (): PluginOption {
  return {
    name: 'taro-vue2:common',
    config: () => ({
      resolve: {
        dedupe: process.env.NODE_ENV !== 'production' ? ['vue'] : []
      }
    })
  }
}
