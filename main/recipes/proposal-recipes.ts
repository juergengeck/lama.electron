/**
 * ONE.core Recipe for ProposalConfig objects
 *
 * User configuration for proposal matching and ranking algorithm
 * Versioned object with userEmail as ID property
 */
export const ProposalConfigRecipe = {
    $type$: 'Recipe',
    name: 'ProposalConfig',
    rule: [
        {
            itemprop: '$type$',
            itemtype: { type: 'string', regexp: /^ProposalConfig$/ }
        },
        {
            itemprop: 'userEmail',
            itemtype: { type: 'string' },
            isId: true // Makes this a versioned object per user
        },
        {
            itemprop: 'matchWeight',
            itemtype: { type: 'number' } // 0.0 to 1.0
        },
        {
            itemprop: 'recencyWeight',
            itemtype: { type: 'number' } // 0.0 to 1.0
        },
        {
            itemprop: 'recencyWindow',
            itemtype: { type: 'integer' } // milliseconds
        },
        {
            itemprop: 'minJaccard',
            itemtype: { type: 'number' } // 0.0 to 1.0, minimum threshold
        },
        {
            itemprop: 'maxProposals',
            itemtype: { type: 'integer' } // Maximum proposals to return
        },
        {
            itemprop: 'updated',
            itemtype: { type: 'integer' } // Last update timestamp
        },
        {
            itemprop: '$versionHash$',
            itemtype: { type: 'string' },
            optional: true
        }
    ]
};
