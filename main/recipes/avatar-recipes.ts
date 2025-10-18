/**
 * Avatar Preference Recipe
 * Stores persistent avatar color preferences for contacts
 */

import type { Recipe } from '@refinio/one.core/lib/recipes.js'
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js'
import type { Person } from '@refinio/one.core/lib/recipes.js'

export const AvatarPreferenceRecipe: Recipe = {
    $type$: 'Recipe',
    name: 'AvatarPreference',
    rule: [
        {
            itemprop: 'personId',
            itemtype: {
                type: 'string'
            },
            isId: true
        },
        {
            itemprop: 'color',
            itemtype: {
                type: 'string'
            }
        },
        {
            itemprop: 'mood',
            itemtype: {
                type: 'string'
            },
            optional: true
        },
        {
            itemprop: 'updatedAt',
            itemtype: {
                type: 'integer'
            }
        }
    ]
}
